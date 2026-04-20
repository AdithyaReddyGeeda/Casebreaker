import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { HARLOW_MANOR } from "@/lib/cases/harlow-manor";
import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import { resolveInterrogationLlmProvider } from "@/lib/investigation/interrogationLlmProvider";

export const runtime = "nodejs";

const MAX_MESSAGES = 14;
const MAX_QUESTIONS = 4;

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

/** Exhibit names only — avoids leaking full descriptions into the suggestion model. */
function buildDiscoveredExhibitHint(ids: unknown): string {
  if (!Array.isArray(ids) || ids.length === 0) {
    return "No exhibits logged yet — prefer broad, neutral lines of inquiry (timeline, relationships, who was where).";
  }
  const known = new Set(
    HARLOW_MANOR.evidence.map((e) => e.id as string)
  );
  const names = ids
    .filter((x): x is EvidenceId => typeof x === "string" && known.has(x))
    .map((id) => HARLOW_MANOR.evidence.find((e) => e.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) {
    return "No exhibits logged yet — prefer broad investigation angles.";
  }
  return `Exhibit titles the detective has in the file (may allude to these, never quote solution text): ${names.join("; ")}.`;
}

function suspectBlurb(suspectId: SuspectId): string {
  const s = HARLOW_MANOR.suspects.find((x) => x.id === suspectId);
  if (!s) return suspectId;
  return `${s.name} — ${s.occupation}. ${s.relationship}.`;
}

function buildFairPlaySystem(params: {
  stress: number;
  openingAngles: boolean;
}): string {
  const { stress, openingAngles } = params;
  const stressHint =
    stress >= 60
      ? "The interview is tense — follow-ups may press harder on inconsistencies, but still do not solve the case for the player."
      : stress >= 30
        ? "Mix pointed checks with neutral clarification."
        : "Prioritize rapport, timelines, and open-ended checks.";

  return `You write suggested NEXT QUESTIONS for a 1923 English country-house murder investigation video game. The human player is the detective; your job is to help them *investigate well* without spoiling the mystery.

Output ONLY valid JSON (no markdown fences) with this exact shape:
{"questions":["question 1", "question 2", ...]}

Exactly ${MAX_QUESTIONS} strings (or fewer if impossible). Each string: ONE spoken question, under 115 characters, 1920s formal tone.

CRITICAL — DO NOT:
- Name who committed the murder or state the canonical solution.
- Accuse this interviewee of murder outright unless the transcript already contains such an accusation.
- Reveal the full method+motive chain (e.g. do not spell out poison+will+exact disposal as a solved package).
- Invent exhibits the detective has not found (see exhibit hint in the user message).
- Repeat a question that already appears verbatim in the transcript (when transcript exists).

DO:
- ${openingAngles ? "These are OPENING prompts before much has been said: invite alibi, movements, relationship to the victim, knowledge of the household — still fair-play." : "Ground every suggestion in what was JUST said in the transcript — tighten timelines, probe slips, ask for detail on emotions or locations."}
- Help the player notice *inconsistencies to pursue* and *facts to verify* — nudge toward deduction, not the answer.
- You may reference tensions between people or doubts about stories without naming the killer.
- ${stressHint}

Setting: ${HARLOW_MANOR.setting}, ${HARLOW_MANOR.date}. Victim: ${HARLOW_MANOR.victim.name} (${HARLOW_MANOR.victim.causeOfDeath} — do not turn suggestions into a coroner's lecture).`;
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
    max_tokens: 320,
    temperature: 0.62,
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
    max_tokens: 320,
    temperature: 0.62,
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
    const discoveredEvidence = raw.discoveredEvidence;
    const openingAngles = raw.openingAngles === true;

    if (
      typeof suspectId !== "string" ||
      !["fenn", "victoria", "oliver"].includes(suspectId)
    ) {
      return Response.json({ error: "Invalid suspectId" }, { status: 400 });
    }

    const sid = suspectId as SuspectId;

    if (!Array.isArray(messages)) {
      return Response.json({ error: "Invalid messages" }, { status: 400 });
    }

    if (messages.length === 0 && !openingAngles) {
      return Response.json({ questions: [] as string[] });
    }

    if (messages.length > 0 && openingAngles) {
      return Response.json({ error: "Use openingAngles only with empty messages" }, { status: 400 });
    }

    const normalized =
      messages.length > 0
        ? messages
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
            }))
        : [];

    if (messages.length > 0 && normalized.length === 0) {
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

    const exhibitHint = buildDiscoveredExhibitHint(discoveredEvidence);
    const system = buildFairPlaySystem({
      stress,
      openingAngles,
    });

    const transcript =
      normalized.length > 0 ? buildTranscript(normalized) : "(No dialogue yet.)";

    const user = `Interview subject: ${suspectBlurb(sid)}

${exhibitHint}

Stress (UI): ${stress}/100

${openingAngles ? "Generate opening investigation questions only — the detective is about to begin or has not yet exchanged lines in this session." : "Transcript so far:\n" + transcript}

Return JSON only.`;

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
