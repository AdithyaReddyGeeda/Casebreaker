import type {
  InterrogationRequest,
  InterrogationResult,
  InterrogationStreamChunk,
  SpeakRequest,
} from "./types";
import type { InterrogationTurnStoreSnapshot } from "./interrogationTurn";

/**
 * Stable surface for interrogation + speech used by `investigationService` facades.
 * UI imports only `@/lib/investigation` — never this interface directly.
 */
export interface InvestigationEngine {
  readonly id: "local-next" | "backend-fastapi";

  interrogateSuspect(
    params: InterrogationRequest,
    onChunk: (chunk: InterrogationStreamChunk) => void,
    sessionContext?: InterrogationTurnStoreSnapshot
  ): Promise<InterrogationResult>;

  synthesizeSpeech(params: SpeakRequest): Promise<{ audioBase64: string } | null>;
}
