import type { SuspectId } from "@/lib/cases/harlow-manor";

/**
 * Deterministic keyword hits on the detective's question → stress delta for the suspect.
 * Lives in code, not in the LLM system prompt.
 */
export const QUESTION_STRESS_KEYWORDS: Record<SuspectId, readonly string[]> = {
  fenn: [
    "strychnine",
    "victoria",
    "bag",
    "vial",
    "guest wing",
    "love",
    "lying",
    "corridor",
    "missing",
  ],
  victoria: [
    "will",
    "amended",
    "charity",
    "gloves",
    "greenhouse",
    "diary",
    "strychnine",
    "guest wing",
    "corridor",
    "garden",
    "poison",
  ],
  oliver: [
    "gambling",
    "debt",
    "inheritance",
    "argue",
    "argument",
    "library",
    "money",
    "fight",
    "quarrel",
  ],
} as const;

const MAX_IMPACT = 25;
const PER_HIT = 8;

export function calculateQuestionStressImpact(suspectId: SuspectId, question: string): number {
  const lower = question.toLowerCase();
  const keywords = QUESTION_STRESS_KEYWORDS[suspectId] ?? [];
  const hits = keywords.filter((k) => lower.includes(k)).length;
  return Math.min(MAX_IMPACT, hits * PER_HIT);
}

export type StressBand = "low" | "moderate" | "high";

/** Maps UI / store stress (0–100) to band for prompt flavor text only — does not change game rules. */
export function stressBandFromNumericLevel(stressLevel: number): StressBand {
  if (stressLevel >= 70) return "high";
  if (stressLevel >= 40) return "moderate";
  return "low";
}

export function stressBandInstructionFragment(band: StressBand): string {
  switch (band) {
    case "high":
      return "\n\nCURRENT STRESS LEVEL: Very high. The detective is pressing hard. You are beginning to show cracks.";
    case "moderate":
      return "\n\nCURRENT STRESS LEVEL: Moderate. Some pointed questions. Maintain composure but be wary.";
    default:
      return "\n\nCURRENT STRESS LEVEL: Low. Early in the interrogation. Be composed and measured.";
  }
}

/** Top-bar stress label (same thresholds as interrogation UI). */
export function interrogationStressTopBarLabel(stress: number): string {
  if (stress >= 70) return "Breaking";
  if (stress >= 40) return "Uneasy";
  return "Calm";
}

export function interrogationStressBarColor(stress: number): string {
  if (stress >= 70) return "#f44336";
  if (stress >= 40) return "#FF9800";
  return "#4CAF50";
}

export function interrogationPortraitStressed(stress: number): boolean {
  return stress >= 40;
}

export function interrogationBottomStressHint(stress: number): string | null {
  if (stress < 40) return null;
  return stress >= 70 ? "On the verge of breaking." : "Growing visibly uneasy.";
}
