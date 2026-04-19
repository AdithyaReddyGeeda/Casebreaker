import type { SuspectId } from "@/lib/cases/harlow-manor";

/** Snapshot of store fields passed into `interrogateSuspect` (canonical truth + session correlation). */
export interface InterrogationTurnStoreSnapshot {
  caseId: string;
  sessionId: string | null;
  canonicalKillerId: SuspectId;
  /** FastAPI session token from `tryAugmentBackendSession`; required for backend interrogation engine. */
  backendSessionToken?: string | null;
}
