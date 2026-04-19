import type {
  InterrogationRequest,
  InterrogationResult,
  InterrogationStreamChunk,
  SpeakRequest,
} from "./types";
import type { InterrogationTurnStoreSnapshot } from "./interrogationTurn";
import type { InvestigationEngine } from "./investigationEngine.types";

/**
 * Streams interrogation via Next `/api/interrogate` and TTS via `/api/speak` (current default).
 */
export class LocalInvestigationEngine implements InvestigationEngine {
  readonly id = "local-next" as const;

  async interrogateSuspect(
    params: InterrogationRequest,
    onChunk: (chunk: InterrogationStreamChunk) => void,
    sessionContext?: InterrogationTurnStoreSnapshot
  ): Promise<InterrogationResult> {
    const streamChunks: InterrogationStreamChunk[] = [];
    const payload =
      sessionContext != null
        ? {
            ...params,
            caseId: sessionContext.caseId,
            sessionId: sessionContext.sessionId,
            canonicalKillerId: sessionContext.canonicalKillerId,
          }
        : params;

    const res = await fetch("/api/interrogate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      throw new Error("Request failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let lineBuf = "";

    const processLine = (line: string) => {
      if (!line.startsWith("data: ")) return;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as InterrogationStreamChunk;
        streamChunks.push(parsed);
        onChunk(parsed);
        if (parsed.type === "token" && parsed.text) {
          fullText += parsed.text;
        }
        if (parsed.type === "error" && parsed.text) {
          fullText += parsed.text;
        }
      } catch {
        /* incomplete JSON — wait for next chunk */
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
      }
    }
    if (lineBuf.trim()) {
      processLine(lineBuf);
    }

    return { fullText, streamChunks };
  }

  async synthesizeSpeech(
    params: SpeakRequest
  ): Promise<{ audioBase64: string } | null> {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: params.text, voiceId: params.voiceId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { audio?: string };
    if (!data.audio) return null;
    return { audioBase64: data.audio };
  }
}
