/**
 * Resolves OpenAI `max_tokens` / Anthropic `max_tokens` for interrogation.
 *
 * Priority:
 * 1. `INTERROGATION_MAX_OUTPUT_TOKENS` env — fixed cap (disables heuristics when set to a valid number).
 * 2. Optional `clientMaxTokens` from POST body (clamped).
 * 3. Heuristic from stress (0–100) + question length — keeps replies short but allows a bit more under pressure or for long questions.
 */

const HEURISTIC_MIN = 85;
const HEURISTIC_MAX = 185;
const CLIENT_CLAMP = { min: 64, max: 256 } as const;
const ENV_CLAMP = { min: 32, max: 512 } as const;

export function resolveInterrogationMaxOutputTokens(params: {
  stressLevel: number;
  question: string;
  /** Optional client hint from `/api/interrogate` JSON */
  clientMaxTokens?: number;
}): number {
  const envRaw = process.env.INTERROGATION_MAX_OUTPUT_TOKENS;
  if (envRaw != null && String(envRaw).trim() !== "") {
    const n = Number(envRaw);
    if (Number.isFinite(n)) {
      return Math.min(ENV_CLAMP.max, Math.max(ENV_CLAMP.min, Math.round(n)));
    }
  }

  if (
    params.clientMaxTokens != null &&
    Number.isFinite(params.clientMaxTokens)
  ) {
    return Math.min(
      CLIENT_CLAMP.max,
      Math.max(CLIENT_CLAMP.min, Math.round(params.clientMaxTokens))
    );
  }

  const stress = Math.max(0, Math.min(100, params.stressLevel));
  const len = params.question.length;
  const stressPart = Math.round((stress / 100) * 48);
  const questionPart = Math.min(32, Math.floor(len / 45));
  return Math.min(
    HEURISTIC_MAX,
    Math.max(HEURISTIC_MIN, 92 + stressPart + questionPart)
  );
}
