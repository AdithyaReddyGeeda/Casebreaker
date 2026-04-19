/**
 * Selects which LLM backs `/api/interrogate`.
 *
 * `INTERROGATION_LLM_PROVIDER` (server env):
 * - `openai` — requires `OPENAI_API_KEY`
 * - `anthropic` — requires `ANTHROPIC_API_KEY`
 * - `auto` or unset — use OpenAI if `OPENAI_API_KEY` is set, else Anthropic if `ANTHROPIC_API_KEY` is set;
 *   if both keys are set, defaults to **openai** (set provider to `anthropic` to use Claude).
 */

export type InterrogationLlmProviderName = "openai" | "anthropic";

export type ResolveInterrogationProviderResult =
  | { ok: true; provider: InterrogationLlmProviderName }
  | { ok: false; error: string; status: number };

export function resolveInterrogationLlmProvider(): ResolveInterrogationProviderResult {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const raw = process.env.INTERROGATION_LLM_PROVIDER?.trim().toLowerCase() ?? "";

  if (raw === "openai") {
    if (!hasOpenAi) {
      return {
        ok: false,
        status: 503,
        error:
          "INTERROGATION_LLM_PROVIDER=openai but OPENAI_API_KEY is missing or empty.",
      };
    }
    return { ok: true, provider: "openai" };
  }

  if (raw === "anthropic") {
    if (!hasAnthropic) {
      return {
        ok: false,
        status: 503,
        error:
          "INTERROGATION_LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing or empty.",
      };
    }
    return { ok: true, provider: "anthropic" };
  }

  if (raw !== "" && raw !== "auto") {
    return {
      ok: false,
      status: 400,
      error:
        `Invalid INTERROGATION_LLM_PROVIDER "${raw}". Use openai, anthropic, or auto.`,
    };
  }

  // auto: prefer OpenAI when both are configured
  if (hasOpenAi && hasAnthropic) {
    return { ok: true, provider: "openai" };
  }
  if (hasOpenAi) {
    return { ok: true, provider: "openai" };
  }
  if (hasAnthropic) {
    return { ok: true, provider: "anthropic" };
  }

  return {
    ok: false,
    status: 503,
    error:
      "No LLM configured: set OPENAI_API_KEY and/or ANTHROPIC_API_KEY (and optionally INTERROGATION_LLM_PROVIDER=openai|anthropic|auto).",
  };
}
