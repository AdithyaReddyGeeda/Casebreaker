import { HARLOW_MANOR } from "@/lib/cases/harlow-manor";
import type { EvidenceId } from "@/lib/cases/harlow-manor";
import type {
  CaseSession,
  InterrogationRequest,
  InterrogationResult,
  InterrogationStreamChunk,
  ResolvedVerdict,
  SpeakRequest,
  VerdictResult,
} from "./types";
import type { InterrogationTurnStoreSnapshot } from "./interrogationTurn";
import { getInvestigationEngine } from "./investigationEngineProvider";

/** Pure session factory — persistence lives in the game store. */
export function startCaseSession(): { session: CaseSession } {
  return {
    session: {
      sessionId: crypto.randomUUID(),
      startedAt: Date.now(),
    },
  };
}

/** Merge examined IDs without mutating the previous array. */
export function mergeExaminedEvidenceIds(
  previous: EvidenceId[],
  evidenceId: EvidenceId
): EvidenceId[] {
  if (previous.includes(evidenceId)) return previous;
  return [...previous, evidenceId];
}

/**
 * Streams interrogation tokens and meta via the active {@link getInvestigationEngine}
 * (local Next `/api/interrogate` or FastAPI when configured).
 */
export async function interrogateSuspect(
  params: InterrogationRequest,
  onChunk: (chunk: InterrogationStreamChunk) => void,
  sessionContext?: InterrogationTurnStoreSnapshot
): Promise<InterrogationResult> {
  return getInvestigationEngine().interrogateSuspect(params, onChunk, sessionContext);
}

export function getVerdict(
  verdict: VerdictResult,
  discoveredEvidenceIds: EvidenceId[],
  adjudication?: {
    examinedEvidenceIds: EvidenceId[];
    contradictionEventIds: string[];
    contradictionCount: number;
  }
): ResolvedVerdict {
  const { verdict: v, killerId, motive } = HARLOW_MANOR;
  const missedEvidenceNames = HARLOW_MANOR.evidence
    .filter((e) => !e.isRedHerring && !discoveredEvidenceIds.includes(e.id))
    .map((e) => e.name);

  const snap = adjudication ?? {
    examinedEvidenceIds: [] as EvidenceId[],
    contradictionEventIds: [] as string[],
    contradictionCount: 0,
  };

  return {
    correct: verdict.correct,
    accusedId: verdict.accusedId,
    playerReasoning: verdict.reasoning,
    trueKillerId: killerId,
    motive,
    canonicalExplanation: v.explanation,
    trueSequence: v.trueSequence,
    missedClueBullets: v.missedClues,
    missedEvidenceNames,
    adjudication: {
      discoveredEvidenceIds: [...discoveredEvidenceIds],
      examinedEvidenceIds: [...snap.examinedEvidenceIds],
      contradictionEventIds: [...snap.contradictionEventIds],
      contradictionCount: snap.contradictionCount,
    },
    narrativeSource: "canonical_case_file",
  };
}

/** TTS via the active engine (defaults to Next `/api/speak`). */
export async function synthesizeSpeech(
  params: SpeakRequest
): Promise<{ audioBase64: string } | null> {
  return getInvestigationEngine().synthesizeSpeech(params);
}

export type { SpeakRequest } from "./types";
