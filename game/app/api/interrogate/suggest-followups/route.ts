import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { resolveInterrogationLlmProvider } from "@/lib/investigation/interrogationLlmProvider";

export const runtime = "nodejs";

const MAX_MESSAGES = 14;
const MAX_QUESTIONS = 6;

function buildTranscript(
  messages: { role: string; content: string }[]
): string {
  return messages
    .slice(-MAX_MESSAGES)
    .map((m) => `${m.role === "user" ? "Detective" : "Suspect"}: ${m.content}`)
    .join("\n");
}

function parseQuestionsPayload(raw: string): string[] {
  let trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) trimmed = fence[1].trim();
  try {
    const j = JSON.parse(trimmed) as { questions?: unknown };
    if (Array.isArray(j.questions)) {
      return j.questions
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch {
    /* fall through */
  }
  return trimmed
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

async function suggestWithOpenAI(system: string, user: string): Promise<string[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model =
    process.env.OPENAI_SUGGEST_FOLLOWUPS_MODEL?.trim() ||
    process.env.OPENAI_INTERROGATION_MODEL?.trim() ||
    "gpt-4o-mini";

  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 450,
    temperature: 0.75,
    response_format: { type: "json_object" },
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  return parseQuestionsPayload(text).slice(0, MAX_QUESTIONS);
}

async function suggestWithAnthropic(system: string, user: string): Promise<string[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const model =
    process.env.ANTHROPIC_SUGGEST_FOLLOWUPS_MODEL?.trim() ||
    "claude-haiku-4-5-20251001";

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 450,
    temperature: 0.75,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  return parseQuestionsPayload(text).slice(0, MAX_QUESTIONS);
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const suspectId = raw.suspectId;
    const messages = raw.messages;
    const stressLevel = raw.stressLevel;

    if (
      typeof suspectId !== "string" ||
      !["fenn", "victoria", "oliver"].includes(suspectId)
    ) {
      return Response.json({ error: "Invalid suspectId" }, { status: 400 });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ questions: [] as string[] });
    }

    const normalized = messages
      .filter(
        (m): m is { role: string; content: string } =>
          m != null &&
          typeof m === "object" &&
          typeof (m as { role?: string }).role === "string" &&
          typeof (m as { content?: string }).content === "string"
      )
      .map((m) => ({
        role: m.role,
        content: String(m.content).slice(0, 8000),
      }));

    if (normalized.length === 0) {
      return Response.json({ questions: [] as string[] });
    }

    const stress =
      typeof stressLevel === "number" && Number.isFinite(stressLevel)
        ? Math.max(0, Math.min(100, stressLevel))
        : typeof stressLevel === "string" && stressLevel.trim() !== ""
          ? Math.max(0, Math.min(100, Number(stressLevel)))
          : 0;

    const resolved = resolveInterrogationLlmProvider();
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status });
    }

    const transcript = buildTranscript(normalized);
    const system = `You help write a 1923 murder-mystery interrogation game. The player is the detective.

Output ONLY valid JSON with this exact shape (no markdown, no prose outside JSON):
{"questions":["short question 1", "short question 2", ...]}

Rules:
- Exactly ${MAX_QUESTIONS} entries (or fewer if the transcript is too thin).
- Each string is ONE short question the detective could ask next (under 120 characters).
- Base questions on what was JUST said — press contradictions, clarify alibis, follow emotional tells.
- Stress level ${stress}/100: ${stress >= 60 ? "favor sharper, more accusatory follow-ups where warranted." : stress >= 30 ? "mix pressure with clarification." : "you may include neutral or rapport-building follow-ups."}
- Do not repeat questions already asked verbatim in the transcript.
- Stay in-universe; do not mention AI or the player.`;

    const user = `Suspect character id: ${suspectId}\n\nTranscript so far:\n${transcript}\n\nPropose the next detective questions as JSON.`;

    const questions =
      resolved.provider === "openai"
        ? await suggestWithOpenAI(system, user)
        : await suggestWithAnthropic(system, user);

    const cleaned = questions
      .map((q) => q.replace(/^["']|["']$/g, "").trim())
      .filter((q) => q.length > 3 && q.length < 220);

    return Response.json({ questions: cleaned.slice(0, MAX_QUESTIONS) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
