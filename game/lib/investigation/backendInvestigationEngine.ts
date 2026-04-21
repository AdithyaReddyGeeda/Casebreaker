import { calculateQuestionStressImpact } from "./interrogationStressRules";
import { getBackendApiBase } from "./investigationRuntimeConfig";
import type {
  InterrogationRequest,
  InterrogationResult,
  InterrogationStreamChunk,
  SpeakRequest,
  SpeakSynthesisResult,
} from "./types";
import type { InterrogationTurnStoreSnapshot } from "./interrogationTurn";
import type { InvestigationEngine } from "./investigationEngine.types";
import { LocalInvestigationEngine } from "./localInvestigationEngine";

interface BackendInterrogateJson {
  response?: string;
  character_name?: string;
}

/**
 * FastAPI session interrogation (`POST /session/{token}/interrogate`).
 * Character ids must match the backend world (Harlow build: fenn | victoria | oliver).
 * TTS remains on the Next `/api/speak` route (no backend TTS in the current API).
 */
export class BackendInvestigationEngine implements InvestigationEngine {
  readonly id = "backend-fastapi" as const;

  private readonly local = new LocalInvestigationEngine();

  async interrogateSuspect(
    params: InterrogationRequest,
    onChunk: (chunk: InterrogationStreamChunk) => void,
    sessionContext?: InterrogationTurnStoreSnapshot
  ): Promise<InterrogationResult> {
    const base = getBackendApiBase();
    const token = sessionContext?.backendSessionToken ?? null;

    if (!base || !token?.trim()) {
      return this.local.interrogateSuspect(params, onChunk, sessionContext);
    }

    const streamChunks: InterrogationStreamChunk[] = [];

    try {
      const res = await fetch(`${base}/session/${encodeURIComponent(token)}/interrogate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: params.suspectId,
          message: params.question,
        }),
      });

      if (!res.ok) {
        return this.local.interrogateSuspect(params, onChunk, sessionContext);
      }

      const stressImpact = calculateQuestionStressImpact(params.suspectId, params.question);
      const meta: InterrogationStreamChunk = { type: "meta", stressImpact };
      streamChunks.push(meta);
      onChunk(meta);

      const data = (await res.json()) as BackendInterrogateJson;
      const text = typeof data.response === "string" ? data.response : "";
      for (const part of chunkTextForUi(text)) {
        const tok: InterrogationStreamChunk = { type: "token", text: part };
        streamChunks.push(tok);
        onChunk(tok);
      }

      return { fullText: text, streamChunks };
    } catch {
      return this.local.interrogateSuspect(params, onChunk, sessionContext);
    }
  }

  async synthesizeSpeech(
    params: SpeakRequest
  ): Promise<SpeakSynthesisResult | null> {
    return this.local.synthesizeSpeech(params);
  }
}

/** Preserves streaming feel without true SSE from FastAPI. */
function chunkTextForUi(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (w.length > 0) out.push(w);
  }
  return out.length > 0 ? out : [text];
}
