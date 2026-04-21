import type {
  Case,
  Evidence,
  EvidenceId,
  Suspect,
  SuspectId,
} from "@/lib/cases/harlow-manor";
import type {
  CharacterTimestampRange,
  VisemeTimeline,
} from "@/lib/character/character-pipeline";

/** Static case definition used by the Harlow Manor build (re-export for service consumers). */
export type GameCase = Case;

export type { Evidence, Suspect, EvidenceId, SuspectId };

export interface InterrogationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface InterrogationRequest {
  suspectId: SuspectId;
  question: string;
  history: InterrogationTurn[];
  discoveredEvidence: EvidenceId[];
  stressLevel: number;
}

/** SSE / stream events from `/api/interrogate` (mirrors route contract). */
export type InterrogationStreamChunk =
  | { type: "meta"; stressImpact: number }
  | { type: "token"; text: string }
  | { type: "error"; text: string };

export interface InterrogationResult {
  fullText: string;
  streamChunks: InterrogationStreamChunk[];
}

export type ContradictionSeverity = "low" | "medium" | "high";

/**
 * Deterministic contradiction / tension record. Dialogue text is only used as a **heuristic cue**
 * for what the suspect claimed; adjudication uses canonical facts + evidence state.
 */
export interface ContradictionEvent {
  id: string;
  /** Monotonic per-session index (0-based). */
  orderIndex: number;
  occurredAt: number;
  suspectId: SuspectId;
  /** Short quote or topic label for what triggered detection. */
  statementReference: string;
  /** Why this contradicts canonical facts or examined evidence. */
  reason: string;
  severity: ContradictionSeverity;
  /** Legacy display line; kept in sync with `reason` where applicable. */
  summary: string;
  relatedEvidenceId?: EvidenceId;
  /** @deprecated Prefer `suspectId`; retained for older readers. */
  relatedSuspectId?: SuspectId;
}

export interface VerdictResult {
  correct: boolean;
  accusedId: SuspectId;
  reasoning: string;
}

/** Inputs snapshotted at verdict time (canonical adjudication, not LLM). */
export interface VerdictAdjudicationSnapshot {
  discoveredEvidenceIds: EvidenceId[];
  examinedEvidenceIds: EvidenceId[];
  contradictionEventIds: string[];
  contradictionCount: number;
}

/** Full verdict view aligned with `VerdictScreen` data needs (for callers outside the UI). */
export interface ResolvedVerdict {
  correct: boolean;
  accusedId: SuspectId;
  playerReasoning: string;
  trueKillerId: SuspectId;
  motive: string;
  canonicalExplanation: string;
  trueSequence: string;
  missedClueBullets: string[];
  missedEvidenceNames: string[];
  /** Deterministic inputs used to build this verdict. */
  adjudication: VerdictAdjudicationSnapshot;
  /** Narrative strings are taken from the static case file, not from generative dialogue. */
  narrativeSource: "canonical_case_file";
}

/** TTS request (Next `/api/speak` or future provider). */
export interface SpeakRequest {
  text: string;
  voiceId: string;
}

export interface SpeakSynthesisResult {
  audioBase64: string;
  characterTimestamps: CharacterTimestampRange[] | null;
  visemeTimeline: VisemeTimeline | null;
  provider?: string;
}

export interface CaseSession {
  sessionId: string;
  startedAt: number;
}

export interface InvestigationSessionState {
  session: CaseSession | null;
  examinedEvidenceIds: EvidenceId[];
  contradictions: ContradictionEvent[];
}

export interface ExamineEvidenceResult {
  examinedEvidenceIds: EvidenceId[];
}
