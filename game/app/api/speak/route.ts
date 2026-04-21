import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
} from "@aws-sdk/client-polly";
import {
  approxVisemeTimelineFromText,
  buildCharacterTimestampsFromText,
  type CharacterTimestampRange,
  type VisemeTimeline,
} from "@/lib/character/character-pipeline";

export const runtime = "nodejs";

const FALLBACK_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Dr. Fenn / Adam

export interface CharacterTimestamp {
  char: string;
  startMs: number;
  endMs: number;
}

type ElevenLabsAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

function parseElevenLabsTimestamps(alignment: ElevenLabsAlignment | undefined): CharacterTimestamp[] {
  if (!alignment) return [];
  const chars = alignment.characters ?? [];
  const starts = alignment.character_start_times_seconds ?? [];
  const ends = alignment.character_end_times_seconds ?? [];
  const count = Math.min(chars.length, starts.length, ends.length);
  return Array.from({ length: count }, (_, i) => ({
    char: chars[i] ?? "",
    startMs: Math.max(0, Math.round((starts[i] ?? 0) * 1000)),
    endMs: Math.max(0, Math.round((ends[i] ?? starts[i] ?? 0) * 1000)),
  }));
}

function buildFallbackTimestamps(text: string, durationMs: number): CharacterTimestamp[] {
  return buildCharacterTimestampsFromText(text, durationMs).map((item) => ({
    char: item.char,
    startMs: item.startMs,
    endMs: item.endMs,
  }));
}

async function elevenlabs(text: string, voiceId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2 },
        }),
      }
    );
    if (!res.ok) { console.warn("ElevenLabs", res.status); return null; }
    const data = await res.json() as { audio_base64?: string; alignment?: ElevenLabsAlignment; normalized_alignment?: ElevenLabsAlignment };
    if (!data.audio_base64) return null;
    const ts = parseElevenLabsTimestamps(data.alignment ?? data.normalized_alignment);
    const visemeTimeline = approxVisemeTimelineFromText(text, "elevenlabs-approx");
    return {
      audio: data.audio_base64,
      characterTimestamps: ts.length > 0 ? ts : buildFallbackTimestamps(text, visemeTimeline.durationMs),
      visemeTimeline,
      provider: "elevenlabs",
    };
  } catch (e) { console.warn("ElevenLabs error:", e); return null; }
}

async function polly(text: string) {
  const { AWS_REGION: region, AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  try {
    const voiceId = (process.env.AWS_POLLY_VOICE_ID ?? "Amy") as VoiceId;
    const client = new PollyClient({ region, credentials: { accessKeyId, secretAccessKey } });
    const audioRes = await client.send(new SynthesizeSpeechCommand({
      Engine: "neural", LanguageCode: "en-GB", VoiceId: voiceId,
      OutputFormat: "mp3", Text: text, TextType: "text",
    }));
    if (!audioRes.AudioStream) return null;
    const bytes = Buffer.from(await audioRes.AudioStream.transformToByteArray());
    const visemeRes = await client.send(new SynthesizeSpeechCommand({
      Engine: "neural",
      LanguageCode: "en-GB",
      VoiceId: voiceId,
      OutputFormat: "json",
      SpeechMarkTypes: ["viseme"],
      Text: text,
      TextType: "text",
    }));
    const durationMs = Math.max(1200, text.length * 55);
    const visemeRaw = visemeRes.AudioStream
      ? Buffer.from(await visemeRes.AudioStream.transformToByteArray()).toString("utf8")
      : "";
    const visemeTimeline = parsePollyVisemes(visemeRaw, durationMs);
    return {
      audio: bytes.toString("base64"),
      characterTimestamps: buildFallbackTimestamps(text, visemeTimeline?.durationMs ?? durationMs),
      visemeTimeline,
      provider: "aws-polly",
    };
  } catch (e) { console.warn("Polly error:", e); return null; }
}

function parsePollyVisemes(raw: string, durationMs: number): VisemeTimeline | null {
  if (!raw.trim()) return null;

  const events = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as { time?: number; value?: string };
      } catch {
        return null;
      }
    })
    .filter((item): item is { time?: number; value?: string } => Boolean(item))
    .map((item) => ({
      timeMs: Math.max(0, item.time ?? 0),
      viseme: item.value ?? "aa",
      strength: 0.85,
    }));

  if (!events.length) return null;

  return {
    provider: "aws-polly",
    durationMs,
    events,
  };
}

export async function POST(req: Request) {
  try {
    const { text, voiceId = FALLBACK_VOICE_ID } = await req.json() as { text: string; voiceId?: string };
    if (!text?.trim()) return new Response(JSON.stringify({ error: "text required" }), { status: 400 });

    const result = (await elevenlabs(text, voiceId)) ?? (await polly(text));
    if (!result) return new Response(JSON.stringify({ error: "All TTS providers unavailable" }), { status: 503 });

    const characterTimestamps: CharacterTimestampRange[] | null = result.characterTimestamps
      ? result.characterTimestamps.map((item) => ({
          char: item.char,
          startMs: item.startMs,
          endMs: item.endMs,
        }))
      : null;

    return new Response(
      JSON.stringify({
        ...result,
        characterTimestamps,
        visemeTimeline: result.visemeTimeline ?? null,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), { status: 500 });
  }
}
