import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import { getEvidence } from "@/lib/cases/harlow-manor";
import { SUSPECT_BASE_SYSTEM_PROMPTS } from "./harlowInterrogationCanon";
import { stressBandFromNumericLevel, stressBandInstructionFragment } from "./interrogationStressRules";

/**
 * Evidence lines for the LLM — derived from the same case file as gameplay (`getEvidence`).
 * Does not grant new facts beyond what the player has discovered.
 */
export function buildEvidenceContextForPrompt(discoveredEvidence: EvidenceId[]): string {
  if (discoveredEvidence.length === 0) return "";
  const lines = discoveredEvidence.map((id) => {
    const ev = getEvidence(id);
    return `- ${ev.name}: ${ev.description}`;
  });
  return `\n\nEVIDENCE THE DETECTIVE HAS ALREADY FOUND:\n${lines.join("\n")}`;
}

/**
 * Full system prompt for `/api/interrogate`. Outcome/progression/verdict are not decided here —
 * only in-character reply style + known discovered evidence + stress flavor.
 */
const REPLY_LENGTH_SUFFIX = `

GLOBAL REPLY LENGTH (applies to every answer):
- Hard limit: at most 3 short sentences, under 70 words total.
- Sound like spoken interrogation dialogue — no lists, no numbered points, no “In conclusion”.
- If you already said the essential thing, stop. Do not pad or recap.`;

export function buildInterrogationSystemPrompt(
  suspectId: SuspectId,
  discoveredEvidence: EvidenceId[],
  stressLevel: number
): string {
  const base = SUSPECT_BASE_SYSTEM_PROMPTS[suspectId];
  const evidenceCtx = buildEvidenceContextForPrompt(discoveredEvidence);
  const band = stressBandFromNumericLevel(stressLevel);
  const stressNote = stressBandInstructionFragment(band);
  return `${base}${evidenceCtx}${stressNote}${REPLY_LENGTH_SUFFIX}`;
}
