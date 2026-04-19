/**
 * How the game talks to interrogation / speech runtimes.
 * - `local`: Next.js `/api/interrogate` + `/api/speak` (Harlow + Anthropic/ElevenLabs as today).
 * - `backend`: FastAPI `NEXT_PUBLIC_CASEBREAKER_API_URL` for interrogation; TTS still uses Next `/api/speak` unless extended later.
 */
export type InvestigationRuntimeMode = "local" | "backend";

export function getBackendApiBase(): string | null {
  if (typeof process === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_CASEBREAKER_API_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}

/**
 * `NEXT_PUBLIC_CASEBREAKER_RUNTIME`:
 * - unset / `local` → local Next API routes (default; preserves shipped behavior).
 * - `backend` → interrogation uses FastAPI when `backendSessionToken` + base URL exist; otherwise falls back to local engine.
 */
export function getInvestigationRuntimeMode(): InvestigationRuntimeMode {
  if (typeof process === "undefined") return "local";
  const raw = process.env.NEXT_PUBLIC_CASEBREAKER_RUNTIME?.trim().toLowerCase();
  if (raw === "backend") {
    if (!getBackendApiBase()) {
      if (typeof console !== "undefined" && process.env.NODE_ENV === "development") {
        console.warn(
          "[casebreaker] NEXT_PUBLIC_CASEBREAKER_RUNTIME=backend but NEXT_PUBLIC_CASEBREAKER_API_URL is missing; using local engine."
        );
      }
      return "local";
    }
    return "backend";
  }
  return "local";
}
