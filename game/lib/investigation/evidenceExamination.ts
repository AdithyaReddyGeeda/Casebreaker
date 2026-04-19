import { getEvidence } from "@/lib/cases/harlow-manor";
import type { EvidenceId, RoomId, SuspectId } from "@/lib/cases/harlow-manor";
import type { CanonicalCaseFacts } from "@/lib/investigationCanonical";

/**
 * Deterministic “fact” keys unlocked when an evidence item is formally examined.
 * Used by interrogation/contradiction engines and future UI; not LLM-generated.
 */
const FACTS_UNLOCKED_BY_EVIDENCE: Partial<Record<EvidenceId, string[]>> = {
  ev_brandy: ["fact:method:strychnine_in_brandy", "fact:scene:library_glass"],
  ev_bag: ["fact:source:strychnine_access_medical_bag", "fact:suspect:fenn_means"],
  ev_will: ["fact:motive:disinheritance_charity", "fact:document:amended_will_oct7"],
  ev_gloves: ["fact:opportunity:greenhouse_gloves", "fact:timeline:evening_garden"],
  ev_diary: ["fact:motive:diary_resolution_oct12", "fact:intent:victoria_premeditation"],
  ev_debt: ["fact:pressure:oliver_gambling_debt", "fact:red_herring:oliver_financial_motive"],
};

export interface EvidenceExaminationDetail {
  evidenceId: EvidenceId;
  name: string;
  description: string;
  room: RoomId;
  /** From canonical case truth, not dialogue */
  implicates: SuspectId | null;
  isRedHerring: boolean;
  unlockedFactIds: string[];
}

export function getFactsUnlockedByEvidence(evidenceId: EvidenceId): string[] {
  return [...(FACTS_UNLOCKED_BY_EVIDENCE[evidenceId] ?? [])];
}

/**
 * Structured record combining static exhibit data with canonical `evidenceTruth`.
 */
export function buildEvidenceExaminationDetail(
  evidenceId: EvidenceId,
  canonicalCaseFacts: CanonicalCaseFacts
): EvidenceExaminationDetail {
  const ev = getEvidence(evidenceId);
  const truth = canonicalCaseFacts.evidenceTruth[evidenceId];
  return {
    evidenceId,
    name: ev.name,
    description: ev.description,
    room: ev.room,
    implicates: truth?.implicates ?? null,
    isRedHerring: truth?.isRedHerring ?? false,
    unlockedFactIds: getFactsUnlockedByEvidence(evidenceId),
  };
}

/** Merge unique fact ids into an existing list (immutable). */
export function mergeUnlockedFactIds(
  current: readonly string[],
  additions: readonly string[]
): string[] {
  return [...new Set([...current, ...additions])];
}
