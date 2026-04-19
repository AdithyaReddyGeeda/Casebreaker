import { HARLOW_MANOR } from "@/lib/cases/harlow-manor";
import type { Case, EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";

/**
 * Deterministic case truth from the case file (not LLM-generated).
 * Supports scoring, consistency checks, and verdict logic separate from dialogue.
 */
export interface CanonicalCaseFacts {
  caseId: string;
  title: string;
  killerId: SuspectId;
  motive: string;
  victim: {
    name: string;
    age: number;
    occupation: string;
    causeOfDeath: string;
  };
  /** Per-evidence ground truth for implicates / herring flags */
  evidenceTruth: Record<
    EvidenceId,
    { implicates: SuspectId | null; isRedHerring: boolean }
  >;
  timeline: { time: string; event: string }[];
  solution: {
    explanation: string;
    trueSequence: string;
    missedClues: string[];
  };
}

export interface SuspectCanonicalState {
  /** Mirrors UI `suspectStress` — single stress value for this suspect */
  stress: number;
  /** Count of user+assistant messages in the interrogation transcript */
  interrogationMessageCount: number;
}

export type AccusationStatus = "none" | "submitted";

export type VerdictStatus = "none" | "resolved";

export function buildCanonicalCaseFacts(c: Case): CanonicalCaseFacts {
  const evidenceTruth = {} as CanonicalCaseFacts["evidenceTruth"];
  for (const e of c.evidence) {
    evidenceTruth[e.id] = {
      implicates: e.implicates,
      isRedHerring: e.isRedHerring,
    };
  }
  return {
    caseId: c.id,
    title: c.title,
    killerId: c.killerId,
    motive: c.motive,
    victim: { ...c.victim },
    evidenceTruth,
    timeline: c.timeline.map((t) => ({ ...t })),
    solution: {
      explanation: c.verdict.explanation,
      trueSequence: c.verdict.trueSequence,
      missedClues: [...c.verdict.missedClues],
    },
  };
}

/** Default facts for the shipped Harlow Manor build */
export const DEFAULT_CANONICAL_CASE_FACTS = buildCanonicalCaseFacts(HARLOW_MANOR);
