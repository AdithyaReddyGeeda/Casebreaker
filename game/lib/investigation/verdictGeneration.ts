import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import { getVerdict } from "./investigationService";
import type { ContradictionEvent, ResolvedVerdict, VerdictResult } from "./types";

/**
 * Canonical accusation outcome: correct iff the accused matches ground-truth killer id
 * from the case file (not from model text or player prose).
 */
export function buildVerdictResultFromCanonicalTruth(
  suspectId: SuspectId,
  reasoning: string,
  canonicalKillerId: SuspectId
): VerdictResult {
  return {
    correct: suspectId === canonicalKillerId,
    accusedId: suspectId,
    reasoning,
  };
}

/**
 * Assembles the stored verdict bundle: narrative from the static case file via `getVerdict`,
 * plus a snapshot of evidence + contradiction state at submission time.
 */
export function buildResolvedVerdictFromCanonicalInputs(input: {
  verdict: VerdictResult;
  discoveredEvidenceIds: readonly EvidenceId[];
  examinedEvidenceIds: readonly EvidenceId[];
  contradictionHistory: readonly ContradictionEvent[];
}): ResolvedVerdict {
  const contradictionCount = input.contradictionHistory.length;
  return getVerdict(
    input.verdict,
    [...input.discoveredEvidenceIds],
    {
      examinedEvidenceIds: [...input.examinedEvidenceIds],
      contradictionEventIds: input.contradictionHistory.map((c) => c.id),
      contradictionCount,
    }
  );
}
