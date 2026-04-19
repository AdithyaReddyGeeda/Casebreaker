import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import type { ContradictionEvent, ResolvedVerdict, VerdictResult } from "./types";
import {
  buildResolvedVerdictFromCanonicalInputs,
  buildVerdictResultFromCanonicalTruth,
} from "./verdictGeneration";

/**
 * Full accusation request assembled from session + investigation state.
 * Correctness still derives from canonical case file (`killerId`), not from this snapshot alone.
 */
export interface AccusationSubmissionPayload {
  suspectId: SuspectId;
  reasoning: string;
  discoveredEvidenceIds: EvidenceId[];
  /** Evidence formally examined (cards opened); used in canonical verdict adjudication snapshot. */
  examinedEvidenceIds: EvidenceId[];
  /** Ground-truth killer from `canonicalCaseFacts` (case file), not inferred. */
  canonicalKillerId: SuspectId;
  contradictionHistory: readonly ContradictionEvent[];
  caseId: string;
  sessionId: string | null;
  sessionStartedAt: number | null;
  unlockedCanonicalFactIds: readonly string[];
}

export interface AccusationSubmissionMeta {
  submittedAt: number;
  caseId: string;
  sessionId: string | null;
  discoveredEvidenceIds: EvidenceId[];
  contradictionEventIdsSnapshot: string[];
  contradictionCountAtSubmission: number;
  unlockedCanonicalFactIdsSnapshot: string[];
}

export interface AccusationEngineResult {
  verdict: VerdictResult;
  resolvedVerdict: ResolvedVerdict;
  submissionMeta: AccusationSubmissionMeta;
}

export type AccusationValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const MIN_REASONING_LENGTH = 1;

/**
 * Structural validation (UI may already gate submit).
 */
export function validateAccusationPayload(
  payload: AccusationSubmissionPayload
): AccusationValidationResult {
  if (!payload.suspectId) {
    return { ok: false, error: "No suspect selected." };
  }
  const r = payload.reasoning?.trim() ?? "";
  if (r.length < MIN_REASONING_LENGTH) {
    return { ok: false, error: "Reasoning is required." };
  }
  return { ok: true };
}

/**
 * Evaluates accusation against canonical solution and builds resolved verdict + audit metadata.
 * Does not call remote APIs.
 */
export function executeAccusationSubmission(
  payload: AccusationSubmissionPayload
): AccusationEngineResult {
  const v = validateAccusationPayload(payload);
  if (!v.ok) {
    throw new Error(v.error);
  }

  const verdict = buildVerdictResultFromCanonicalTruth(
    payload.suspectId,
    payload.reasoning.trim(),
    payload.canonicalKillerId
  );

  const resolvedVerdict = buildResolvedVerdictFromCanonicalInputs({
    verdict,
    discoveredEvidenceIds: payload.discoveredEvidenceIds,
    examinedEvidenceIds: payload.examinedEvidenceIds,
    contradictionHistory: payload.contradictionHistory,
  });

  const contradictionCount = payload.contradictionHistory.length;
  const submissionMeta: AccusationSubmissionMeta = {
    submittedAt: Date.now(),
    caseId: payload.caseId,
    sessionId: payload.sessionId,
    discoveredEvidenceIds: [...payload.discoveredEvidenceIds],
    contradictionEventIdsSnapshot: payload.contradictionHistory.map((c) => c.id),
    contradictionCountAtSubmission: contradictionCount,
    unlockedCanonicalFactIdsSnapshot: [...payload.unlockedCanonicalFactIds],
  };

  return {
    verdict,
    resolvedVerdict,
    submissionMeta,
  };
}
