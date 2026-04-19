import { HARLOW_MANOR } from "@/lib/cases/harlow-manor";
import type { Evidence, Suspect } from "@/lib/cases/harlow-manor";
import { DEFAULT_CANONICAL_CASE_FACTS, type CanonicalCaseFacts } from "@/lib/investigationCanonical";
import { getBackendApiBase } from "./investigationRuntimeConfig";
import { startCaseSession } from "./investigationService";
import type { CaseSession } from "./types";

/** Where the active run’s case content came from (UI always ships Harlow data today). */
export type CaseSessionRunSource = "local" | "remote_augmented";

/**
 * Full payload used to hydrate investigation state when a run starts.
 * Suspects / evidence mirror the active case file; the UI continues to read `HARLOW_MANOR` directly.
 */
export interface InvestigationHydration {
  session: CaseSession;
  caseId: string;
  canonicalCaseFacts: CanonicalCaseFacts;
  suspects: Suspect[];
  evidence: Evidence[];
  source: CaseSessionRunSource;
  /** FastAPI session token when `NEXT_PUBLIC_CASEBREAKER_API_URL` is reachable. */
  backendSessionToken?: string;
}

/** Same adapter shape for local-only, remote-first, or composite fallback pipelines. */
export interface CaseSessionAdapter {
  readonly id: string;
  initialize(): Promise<InvestigationHydration>;
}

function fetchWithTimeout(
  input: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

/**
 * Attempts to obtain a backend session token. Does not throw — returns null on any failure.
 */
export async function tryBackendSessionToken(): Promise<string | null> {
  const base = getBackendApiBase();
  if (!base) return null;
  try {
    const daily = await fetchWithTimeout(`${base}/daily/case`, { method: "GET" }, 8000);
    if (!daily.ok) return null;
    const start = await fetchWithTimeout(
      `${base}/session/start`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
      8000
    );
    if (!start.ok) return null;
    const data = (await start.json()) as { session_token?: string };
    return typeof data.session_token === "string" ? data.session_token : null;
  } catch {
    return null;
  }
}

/**
 * Synchronous hydration for the shipped Harlow Manor case (deterministic truth + new client session).
 * Call at the first transition to `cinematic` so navigation stays synchronous.
 */
export function createLocalInvestigationHydration(): InvestigationHydration {
  const { session } = startCaseSession();
  return {
    session,
    caseId: DEFAULT_CANONICAL_CASE_FACTS.caseId,
    canonicalCaseFacts: DEFAULT_CANONICAL_CASE_FACTS,
    suspects: HARLOW_MANOR.suspects.map((s) => ({ ...s })),
    evidence: HARLOW_MANOR.evidence.map((e) => ({ ...e })),
    source: "local",
  };
}

/** Local-only adapter (always resolves). */
export class LocalCaseSessionAdapter implements CaseSessionAdapter {
  readonly id = "local-harlow";
  async initialize(): Promise<InvestigationHydration> {
    return createLocalInvestigationHydration();
  }
}

/**
 * Tries backend session token + keeps Harlow case payload; falls back to pure local on failure.
 * Same `initialize()` contract as `LocalCaseSessionAdapter`.
 */
export class FallbackCaseSessionAdapter implements CaseSessionAdapter {
  readonly id = "fallback-backend-local-case";
  async initialize(): Promise<InvestigationHydration> {
    const local = createLocalInvestigationHydration();
    const token = await tryBackendSessionToken();
    if (token) {
      return {
        ...local,
        backendSessionToken: token,
        source: "remote_augmented",
      };
    }
    return local;
  }
}

let defaultAdapter: CaseSessionAdapter = new FallbackCaseSessionAdapter();

/** For tests or future wiring (e.g. remote-only). */
export function setDefaultCaseSessionAdapter(adapter: CaseSessionAdapter): void {
  defaultAdapter = adapter;
}

export function getDefaultCaseSessionAdapter(): CaseSessionAdapter {
  return defaultAdapter;
}

/**
 * Async entry matching the adapter interface: local case + optional backend token.
 * Prefer `createLocalInvestigationHydration` + `tryAugmentBackendSession` in the store for split sync/async.
 */
export async function initializeInvestigationSession(
  adapter: CaseSessionAdapter = defaultAdapter
): Promise<InvestigationHydration> {
  return adapter.initialize();
}

/**
 * Non-throwing backend augmentation after local session is already in the store.
 */
export async function tryAugmentBackendSession(): Promise<{
  token: string;
  source: CaseSessionRunSource;
} | null> {
  const token = await tryBackendSessionToken();
  if (!token) return null;
  return { token, source: "remote_augmented" };
}
