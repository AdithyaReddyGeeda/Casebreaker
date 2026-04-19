import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import { buildEvidenceExaminationDetail } from "@/lib/investigation";
import type {
  AccusationSubmissionMeta,
  CaseSession,
  ContradictionEvent,
  EvidenceExaminationDetail,
  InvestigationSessionState,
} from "@/lib/investigation";
import { useGameStore } from "@/lib/store";
import type { Message } from "@/lib/store";

/** Full store snapshot (state + actions) — selectors only read state fields. */
export type GameSnapshot = ReturnType<typeof useGameStore.getState>;

export const selectSessionId = (s: GameSnapshot): string | null => s.sessionId;

export const selectCaseId = (s: GameSnapshot): string => s.caseId;

export const selectCanonicalKillerId = (s: GameSnapshot): SuspectId =>
  s.canonicalCaseFacts.killerId;

export const selectCanonicalFacts = (s: GameSnapshot) => s.canonicalCaseFacts;

export const selectExaminedEvidenceIds = (s: GameSnapshot): EvidenceId[] =>
  s.examinedEvidenceIds;

export const selectUnlockedCanonicalFactIds = (s: GameSnapshot): string[] =>
  s.unlockedCanonicalFactIds;

/** Structured exhibit + canonical truth for one id (derived; not duplicated in state). */
export const selectEvidenceExaminationDetail =
  (evidenceId: EvidenceId) =>
  (s: GameSnapshot): EvidenceExaminationDetail =>
    buildEvidenceExaminationDetail(evidenceId, s.canonicalCaseFacts);

export const selectDiscoveredEvidenceIds = (s: GameSnapshot): EvidenceId[] =>
  s.discoveredEvidence;

export const selectContradictionCount = (s: GameSnapshot): number =>
  s.contradictionHistory.length;

export const selectContradictionHistory = (s: GameSnapshot): ContradictionEvent[] =>
  s.contradictionHistory;

/** Contradictions attributed to a single suspect (for future UI hooks). */
export const selectContradictionsForSuspect =
  (suspectId: SuspectId) =>
  (s: GameSnapshot): ContradictionEvent[] =>
    s.contradictionHistory.filter((c) => c.suspectId === suspectId);

/**
 * Canonical interrogation transcript — same data as `interrogationHistories` (dialogue only).
 * Use this name when reasoning about persistence or engine sync; UI keeps using `interrogationHistories`.
 */
export const selectInterrogationTranscript = (
  s: GameSnapshot
): Record<SuspectId, Message[]> => s.interrogationHistories;

export const selectSuspectStates = (s: GameSnapshot) => s.suspectStates;

export const selectAccusationStatus = (s: GameSnapshot) => s.accusationStatus;

export const selectVerdictStatus = (s: GameSnapshot) => s.verdictStatus;

export const selectResolvedVerdict = (s: GameSnapshot) => s.resolvedVerdict;

export const selectAccusationSubmissionMeta = (
  s: GameSnapshot
): AccusationSubmissionMeta | null => s.accusationSubmissionMeta;

/** Maps store fields into the legacy `InvestigationSessionState` shape for API compatibility. */
export function selectInvestigationSessionState(
  s: GameSnapshot
): InvestigationSessionState {
  const session: CaseSession | null =
    s.sessionId && s.sessionStartedAt != null
      ? { sessionId: s.sessionId, startedAt: s.sessionStartedAt }
      : null;
  return {
    session,
    examinedEvidenceIds: s.examinedEvidenceIds,
    contradictions: s.contradictionHistory,
  };
}
