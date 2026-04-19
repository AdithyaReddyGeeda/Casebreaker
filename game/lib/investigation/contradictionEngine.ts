import { getEvidence } from "@/lib/cases/harlow-manor";
import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import type { CanonicalCaseFacts } from "@/lib/investigationCanonical";
import type { ContradictionEvent, ContradictionSeverity } from "./types";

const STRESS_PER_EVENT = 4;

export interface InterrogationContradictionEngineInput {
  suspectId: SuspectId;
  userMessage: string;
  /** Latest assistant reply in this thread (may be empty). */
  lastAssistantText: string;
  discoveredEvidenceIds: EvidenceId[];
  examinedEvidenceIds: EvidenceId[];
  canonicalCaseFacts: CanonicalCaseFacts;
  existingIds: ReadonlySet<string>;
  /** Next `orderIndex` to assign (usually `contradictionHistory.length`). */
  baseOrderIndex: number;
}

const EVIDENCE_TOPIC_PATTERNS: Partial<Record<EvidenceId, RegExp>> = {
  ev_will: /\b(will|charity|estate|inherit|disinherit|amend|trust|solicitor|document)\b/i,
  ev_brandy: /\b(brandy|glass|poison|strychnine|drink|decanter|rim)\b/i,
  ev_bag: /\b(bag|vial|strychnine|physician|medical|missing|guest wing|room)\b/i,
  ev_gloves: /\b(glove|gloves|greenhouse|mud|garden|orchid)\b/i,
  ev_diary: /\b(diary|journal|entry|october|12th|refuse)\b/i,
  ev_debt: /\b(debt|gambling|claridge|money|loan|owe|pound|quarrel)\b/i,
};

function makeEvent(
  params: {
    id: string;
    orderIndex: number;
    suspectId: SuspectId;
    statementReference: string;
    reason: string;
    severity: ContradictionSeverity;
    relatedEvidenceId?: EvidenceId;
  }
): ContradictionEvent {
  const occurredAt = Date.now();
  return {
    id: params.id,
    orderIndex: params.orderIndex,
    occurredAt,
    suspectId: params.suspectId,
    relatedSuspectId: params.suspectId,
    statementReference: params.statementReference,
    reason: params.reason,
    severity: params.severity,
    summary: params.reason,
    relatedEvidenceId: params.relatedEvidenceId,
  };
}

/**
 * Detective question targets discovered evidence that canonically implicates this suspect.
 */
function detectCanonicalPressEvents(
  input: InterrogationContradictionEngineInput,
  startOrder: number
): ContradictionEvent[] {
  const { suspectId, userMessage, discoveredEvidenceIds, canonicalCaseFacts, existingIds } = input;
  const discovered = new Set(discoveredEvidenceIds);
  const out: ContradictionEvent[] = [];
  let order = startOrder;

  for (const evidenceId of discovered) {
    const truth = canonicalCaseFacts.evidenceTruth[evidenceId];
    if (!truth || truth.implicates !== suspectId) continue;

    const pattern = EVIDENCE_TOPIC_PATTERNS[evidenceId];
    if (!pattern || !pattern.test(userMessage)) continue;

    const id = `canonical-press:${evidenceId}:${suspectId}`;
    if (existingIds.has(id)) continue;

    const ev = getEvidence(evidenceId);
    const herring = truth.isRedHerring;
    const severity: ContradictionSeverity = herring ? "low" : "medium";
    const reason = herring
      ? `Question engages evidence “${ev.name}” (case file marks as red herring for this suspect).`
      : `Question engages discovered evidence “${ev.name}”, which the case file ties to this suspect.`;

    out.push(
      makeEvent({
        id,
        orderIndex: order++,
        suspectId,
        statementReference: `Detective question (topic: ${ev.name})`,
        reason,
        severity,
        relatedEvidenceId: evidenceId,
      })
    );
  }

  return out;
}

/**
 * Prior **assistant** lines vs examined + canonical implicates (heuristic on model text, truth from file).
 */
function detectAnswerVersusExaminedEvidence(
  input: InterrogationContradictionEngineInput,
  startOrder: number
): ContradictionEvent[] {
  const {
    suspectId,
    lastAssistantText,
    examinedEvidenceIds,
    canonicalCaseFacts,
    existingIds,
  } = input;

  if (!lastAssistantText.trim()) return [];

  const examined = new Set(examinedEvidenceIds);
  const assistantLower = lastAssistantText.toLowerCase();
  const out: ContradictionEvent[] = [];
  let order = startOrder;

  const ref = lastAssistantText.length > 120 ? `${lastAssistantText.slice(0, 117)}…` : lastAssistantText;

  type Rule = {
    id: string;
    when: () => boolean;
    evidenceId: EvidenceId;
    statementReference: string;
    reason: string;
    severity: ContradictionSeverity;
  };

  const rules: Rule[] = [];

  if (suspectId === "victoria") {
    rules.push({
      id: "answer-alibi-vs-gloves:victoria",
      when: () =>
        examined.has("ev_gloves") &&
        canonicalCaseFacts.evidenceTruth.ev_gloves?.implicates === "victoria" &&
        /\b(garden|night air|fresh air|evening|orchid|outside)\b/i.test(lastAssistantText),
      evidenceId: "ev_gloves",
      statementReference: ref,
      reason:
        "Prior answer stresses an outdoor or garden alibi; examined greenhouse gloves and timeline facts conflict with that account in the case file.",
      severity: "high",
    });
    rules.push({
      id: "answer-will-knowledge:victoria",
      when: () =>
        examined.has("ev_will") &&
        canonicalCaseFacts.evidenceTruth.ev_will?.implicates === "victoria" &&
        /\b(did not know|knew nothing|wasn't aware|private matter|charity only)\b/i.test(assistantLower),
      evidenceId: "ev_will",
      statementReference: ref,
      reason:
        "Prior answer minimizes knowledge of the estate disposition; examined amended will contradicts ignorance of disinheritance.",
      severity: "high",
    });
  }

  if (suspectId === "fenn") {
    rules.push({
      id: "answer-deflect-bag:fenn",
      when: () =>
        examined.has("ev_bag") &&
        canonicalCaseFacts.evidenceTruth.ev_bag?.implicates === "fenn" &&
        /\b(reading|journal|guest room|quietly)\b/i.test(assistantLower) &&
        /\b(bag|strychnine|vial|medical)\b/i.test(assistantLower) === false,
      evidenceId: "ev_bag",
      statementReference: ref,
      reason:
        "Prior answer emphasizes alibi activity without accounting for examined medical bag / missing vial noted in the case file.",
      severity: "medium",
    });
  }

  if (suspectId === "oliver") {
    rules.push({
      id: "answer-minimize-debt:oliver",
      when: () =>
        examined.has("ev_debt") &&
        canonicalCaseFacts.evidenceTruth.ev_debt?.implicates === "oliver" &&
        /\b(not serious|clerical|mistake|small matter|exaggerat(e|ed|ing)?)\b/i.test(assistantLower),
      evidenceId: "ev_debt",
      statementReference: ref,
      reason:
        "Prior answer downplays money troubles; examined debt letter contradicts minimization (file marks as red herring for guilt, not for debt existence).",
      severity: "medium",
    });
  }

  for (const rule of rules) {
    if (!rule.when()) continue;
    if (existingIds.has(rule.id)) continue;
    out.push(
      makeEvent({
        id: rule.id,
        orderIndex: order++,
        suspectId,
        statementReference: rule.statementReference,
        reason: rule.reason,
        severity: rule.severity,
        relatedEvidenceId: rule.evidenceId,
      })
    );
  }

  return out;
}

/**
 * Full pass: canonical pressure on the **user question**, then statement checks on the **last assistant reply**
 * using **examined** evidence + canonical implicates.
 */
export function runInterrogationContradictionEngine(
  input: InterrogationContradictionEngineInput
): ContradictionEvent[] {
  const { baseOrderIndex } = input;
  const press = detectCanonicalPressEvents(input, baseOrderIndex);
  const nextOrder = baseOrderIndex + press.length;
  const answer = detectAnswerVersusExaminedEvidence(input, nextOrder);
  return [...press, ...answer];
}

export function stressDeltaForNewContradictions(count: number): number {
  if (count <= 0) return 0;
  return Math.min(12, count * STRESS_PER_EVENT);
}

/** Normalize partial events from legacy callers (e.g. tests). */
export function normalizeContradictionEvent(
  event: Partial<ContradictionEvent> & { id: string },
  orderIndex: number,
  fallbackSuspectId: SuspectId
): ContradictionEvent {
  if (
    event.orderIndex !== undefined &&
    event.suspectId &&
    event.statementReference &&
    event.reason &&
    event.severity &&
    event.summary
  ) {
    return event as ContradictionEvent;
  }
  const suspectId = event.suspectId ?? event.relatedSuspectId ?? fallbackSuspectId;
  const reason = event.reason ?? event.summary ?? "Contradiction recorded.";
  return {
    id: event.id,
    orderIndex: event.orderIndex ?? orderIndex,
    occurredAt: event.occurredAt ?? Date.now(),
    suspectId,
    relatedSuspectId: suspectId,
    statementReference: event.statementReference ?? "(unspecified)",
    reason,
    severity: event.severity ?? "medium",
    summary: event.summary ?? reason,
    relatedEvidenceId: event.relatedEvidenceId,
  };
}
