import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import { HARLOW_MANOR } from "@/lib/cases/harlow-manor";

const SUSPECT_IDS = new Set<string>(["fenn", "victoria", "oliver"]);
const KNOWN_EVIDENCE_IDS = new Set<EvidenceId>(HARLOW_MANOR.evidence.map((e) => e.id));

export type InterrogationPostBody = {
  suspectId: SuspectId;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  discoveredEvidence: EvidenceId[];
  stressLevel: number;
};

function isEvidenceIdArray(v: unknown): v is EvidenceId[] {
  return (
    Array.isArray(v) &&
    v.every((x) => typeof x === "string" && KNOWN_EVIDENCE_IDS.has(x as EvidenceId))
  );
}

function isHistoryArray(
  v: unknown
): v is { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (m) =>
      m &&
      typeof m === "object" &&
      (m as { role?: string }).role !== undefined &&
      ["user", "assistant"].includes((m as { role: string }).role) &&
      typeof (m as { content: string }).content === "string"
  );
}

/**
 * Validates `/api/interrogate` POST JSON — deterministic gate before any model call.
 */
export function parseInterrogationPostBody(raw: unknown):
  | { ok: true; body: InterrogationPostBody }
  | { ok: false; error: string; status: number } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, error: "Invalid body", status: 400 };
  }
  const o = raw as Record<string, unknown>;

  const suspectId = o.suspectId;
  if (typeof suspectId !== "string" || !SUSPECT_IDS.has(suspectId)) {
    return { ok: false, error: "suspectId and question are required", status: 400 };
  }

  const question = o.question;
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "suspectId and question are required", status: 400 };
  }

  const history = o.history;
  if (!isHistoryArray(history)) {
    return { ok: false, error: "Invalid history", status: 400 };
  }

  const discoveredEvidence = o.discoveredEvidence;
  if (!isEvidenceIdArray(discoveredEvidence)) {
    return { ok: false, error: "Invalid discoveredEvidence", status: 400 };
  }

  const stressLevel = o.stressLevel;
  const stress =
    typeof stressLevel === "number" && Number.isFinite(stressLevel)
      ? stressLevel
      : typeof stressLevel === "string" && stressLevel.trim() !== ""
        ? Number(stressLevel)
        : NaN;
  if (!Number.isFinite(stress)) {
    return { ok: false, error: "Invalid stressLevel", status: 400 };
  }

  return {
    ok: true,
    body: {
      suspectId: suspectId as SuspectId,
      question: question.trim(),
      history,
      discoveredEvidence,
      stressLevel: Math.max(0, Math.min(100, stress)),
    },
  };
}
