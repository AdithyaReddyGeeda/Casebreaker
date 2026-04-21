"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/lib/store";
import { interrogateSuspect, synthesizeSpeech } from "@/lib/investigation";
import {
  approxVisemeTimelineFromText,
  buildCharacterTimestampsFromText,
  type CharacterTimestampRange,
  type VisemeTimeline,
} from "@/lib/character/character-pipeline";
import { getSuspect } from "@/lib/cases/harlow-manor";
import type { SuspectId, EvidenceId } from "@/lib/cases/harlow-manor";
import type { Message } from "@/lib/store";
import {
  INTERROGATION_EMPTY_STATE_INTRO,
  INTERROGATION_STRESS_FOLLOWUP_QUESTIONS,
  INTERROGATION_STRESS_FOLLOWUP_THRESHOLD,
  INTERROGATION_SUGGESTED_QUESTIONS,
} from "@/lib/investigation/interrogationUiCopy";
import {
  interrogationBottomStressHint,
  interrogationPortraitStressed,
  interrogationStressBarColor,
  interrogationStressTopBarLabel,
  isReassuringQuestion,
} from "@/lib/investigation/interrogationStressRules";
import InterrogationRoomScene3D from "@/components/interrogation/InterrogationRoomScene3D";
import EvidenceBoard from "@/components/ui/EvidenceBoard";
import { getDiscoveredEvidence } from "@/lib/evidence/sampleEvidence";

/** New AI batches after this many suggestion-chip taps (aim for 2–3 uses of the current set). */
const MIN_SUGGESTION_USES_BEFORE_REFRESH = 3;
const MAX_VISIBLE_SUGGESTION_CHIPS = 4;

function SuspectMetaFooter({ suspectId, stressed }: { suspectId: SuspectId; stressed: boolean }) {
  const suspect = getSuspect(suspectId);
  return (
    <div className="text-center z-10 px-2 pb-4 pt-2 flex-shrink-0 border-t border-white/5">
      <div
        className="text-sm font-semibold tracking-[2px] uppercase text-[#E8E0D0]"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {suspect.name}
      </div>
      <div className="text-[10px] text-[#D4A843] mt-1 tracking-wider">
        {stressed ? "Visibly tense" : "Composed"}
      </div>
      <div className="text-[9px] text-[#445566] mt-0.5 italic">{suspect.occupation}</div>
    </div>
  );
}

export default function InterrogationRoom() {
  const {
    selectedSuspect,
    goTo,
    discoveredEvidence,
    evidence,
    selectedEvidenceIds,
    suspectStress,
    interrogationHistories,
    addMessages,
    increaseStress,
    caseId,
    sessionId,
    canonicalCaseFacts,
    backendSessionToken,
    recordInterrogationTurnOutcome,
  } = useGameStore();
  const canonicalKillerId = canonicalCaseFacts.killerId;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [characterTimestamps, setCharacterTimestamps] = useState<CharacterTimestampRange[] | null>(
    null
  );
  const [visemeTimeline, setVisemeTimeline] = useState<VisemeTimeline | null>(null);
  const [speechElapsedMs, setSpeechElapsedMs] = useState(0);
  const [contextFollowUps, setContextFollowUps] = useState<string[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioEnabled = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechFrameRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  /** Counts clicks on suggestion chips since the last batch was loaded from the API. */
  const suggestionUsesSinceBatchRef = useRef(0);

  const messages: Message[] = useMemo(
    () => (selectedSuspect ? interrogationHistories[selectedSuspect] ?? [] : []),
    [selectedSuspect, interrogationHistories]
  );

  const stress =
    selectedSuspect != null ? suspectStress[selectedSuspect] ?? 0 : 0;
  const suspect =
    selectedSuspect != null ? getSuspect(selectedSuspect) : null;
  const stressed = interrogationPortraitStressed(stress);
  const discoveredBoardEvidence = useMemo(
    () => getDiscoveredEvidence(evidence, discoveredEvidence),
    [discoveredEvidence, evidence]
  );
  const activeEvidenceSelection = useMemo(
    () => discoveredBoardEvidence.filter((item) => selectedEvidenceIds.includes(item.id)),
    [discoveredBoardEvidence, selectedEvidenceIds]
  );
  const contradictoryEvidence = useMemo(
    () =>
      selectedSuspect
        ? activeEvidenceSelection.filter((item) => item.contradicts.includes(selectedSuspect))
        : [],
    [activeEvidenceSelection, selectedSuspect]
  );
  const hasInterrogationMessages = messages.length > 0;
  const supportiveEvidence = useMemo(
    () =>
      selectedSuspect
        ? activeEvidenceSelection.filter((item) => item.supports.includes(selectedSuspect))
        : [],
    [activeEvidenceSelection, selectedSuspect]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayText]);

  useEffect(() => {
    setContextFollowUps([]);
    suggestionUsesSinceBatchRef.current = 0;
  }, [selectedSuspect]);

  const stopSpeechClock = useCallback(() => {
    if (speechFrameRef.current != null) {
      window.cancelAnimationFrame(speechFrameRef.current);
      speechFrameRef.current = null;
    }
    speechStartRef.current = null;
    setSpeechElapsedMs(0);
  }, []);

  const startSpeechClock = useCallback(() => {
    stopSpeechClock();
    const startedAt = performance.now();
    speechStartRef.current = startedAt;

    const tick = () => {
      if (speechStartRef.current == null) return;
      setSpeechElapsedMs(Math.max(0, performance.now() - speechStartRef.current));
      speechFrameRef.current = window.requestAnimationFrame(tick);
    };

    speechFrameRef.current = window.requestAnimationFrame(tick);
  }, [stopSpeechClock]);

  const finalizeSpeechPlayback = useCallback(() => {
    stopSpeechClock();
    audioRef.current = null;
    setSpeaking(false);
  }, [stopSpeechClock]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      finalizeSpeechPlayback();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [finalizeSpeechPlayback]);

  const fetchFollowUpPayload = useCallback(
    (opts: { openingAngles: boolean; msgs: Message[] }) =>
      JSON.stringify({
        suspectId: selectedSuspect,
        stressLevel: stress,
        discoveredEvidence,
        openingAngles: opts.openingAngles,
        messages: opts.msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    [selectedSuspect, stress, discoveredEvidence]
  );

  /** Fair-play opening chips before any dialogue (replaces static list when API returns). */
  useEffect(() => {
    if (loading || !selectedSuspect) return;
    if (messages.length > 0) return;

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setFollowUpsLoading(true);
      fetch("/api/interrogate/suggest-followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: fetchFollowUpPayload({ openingAngles: true, msgs: [] }),
      })
        .then(async (res) => {
          if (ctrl.signal.aborted) return;
          if (!res.ok) return;
          const data = (await res.json()) as { questions?: unknown };
          if (ctrl.signal.aborted) return;
          if (Array.isArray(data.questions)) {
            setContextFollowUps(
              data.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
            );
            suggestionUsesSinceBatchRef.current = 0;
          }
        })
        .catch(() => {})
        .finally(() => setFollowUpsLoading(false));
    }, 300);

    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [loading, selectedSuspect, messages.length, discoveredEvidence, fetchFollowUpPayload]);

  /** After each suspect reply — refresh transcript suggestions only if the player used enough prior chips. */
  useEffect(() => {
    if (loading || !selectedSuspect) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return;
    if (suggestionUsesSinceBatchRef.current < MIN_SUGGESTION_USES_BEFORE_REFRESH) {
      return;
    }

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setFollowUpsLoading(true);
      fetch("/api/interrogate/suggest-followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: fetchFollowUpPayload({ openingAngles: false, msgs: messages }),
      })
        .then(async (res) => {
          if (ctrl.signal.aborted) return;
          if (!res.ok) return;
          const data = (await res.json()) as { questions?: unknown };
          if (ctrl.signal.aborted) return;
          if (Array.isArray(data.questions)) {
            setContextFollowUps(
              data.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
            );
            suggestionUsesSinceBatchRef.current = 0;
          }
        })
        .catch(() => {})
        .finally(() => setFollowUpsLoading(false));
    }, 450);

    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [messages, loading, selectedSuspect, fetchFollowUpPayload]);

  const speakText = useCallback(async (text: string) => {
    if (!audioEnabled.current || !suspect) return;
    audioRef.current?.pause();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(true);
    const fallbackTimeline = approxVisemeTimelineFromText(text, "local-fallback");
    const fallbackCharacterTimestamps = buildCharacterTimestampsFromText(
      text,
      fallbackTimeline.durationMs
    );
    const safetyTimer = setTimeout(() => finalizeSpeechPlayback(), Math.max(8000, text.length * 80));
    try {
      const out = await synthesizeSpeech({ text, voiceId: suspect.voiceId });
      if (!out) throw new Error("speak unavailable");
      setCharacterTimestamps(out.characterTimestamps ?? fallbackCharacterTimestamps);
      setVisemeTimeline(out.visemeTimeline ?? fallbackTimeline);
      startSpeechClock();

      const el = new Audio(`data:audio/mpeg;base64,${out.audioBase64}`);
      audioRef.current = el;
      el.onended = () => {
        clearTimeout(safetyTimer);
        finalizeSpeechPlayback();
      };
      el.onerror = () => {
        clearTimeout(safetyTimer);
        finalizeSpeechPlayback();
      };
      el.play().catch(() => {
        clearTimeout(safetyTimer);
        finalizeSpeechPlayback();
      });
    } catch {
      setCharacterTimestamps(fallbackCharacterTimestamps);
      setVisemeTimeline(fallbackTimeline);
      startSpeechClock();
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 0.85;
        utterance.lang = "en-GB";
        utterance.onend = () => {
          clearTimeout(safetyTimer);
          finalizeSpeechPlayback();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        clearTimeout(safetyTimer);
        finalizeSpeechPlayback();
      }
    }
  }, [finalizeSpeechPlayback, startSpeechClock, suspect]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !selectedSuspect || !suspect) return;

    const userMsg: Message = { role: "user", content: text };
    addMessages(selectedSuspect, [userMsg]);
    setInput("");
    setLoading(true);
    setDisplayText("");

    try {
      let fullResponse = "";
      const reassuring = isReassuringQuestion(text);
      const evidenceContext =
        reassuring && contradictoryEvidence.length > 0
          ? `\n\n[Detective note: The player's words are reassuring or affirm innocence (e.g. clearing them, believing them). Even if ${contradictoryEvidence
              .map((item) => item.title)
              .join(", ")} is in play, respond with guarded relief or softening — not full panic — unless they also directly accuse.]`
          : reassuring
            ? `\n\n[Detective note: The player is reassuring you or treating you as cleared. Match a calmer, less defensive tone.]`
            : contradictoryEvidence.length > 0
              ? `\n\n[Detective note: The player is confronting the suspect with ${contradictoryEvidence
                  .map((item) => item.title)
                  .join(", ")}. These exhibits contradict the suspect's story, so the reply should feel more defensive, pressured, or inconsistent.]`
              : supportiveEvidence.length > 0
                ? `\n\n[Detective note: The player is referencing ${supportiveEvidence
                    .map((item) => item.title)
                    .join(", ")}, which partly supports this suspect's account. The reply can sound steadier or more confident.]`
                : "";
      const result = await interrogateSuspect(
        {
          suspectId: selectedSuspect,
          question: `${text}${evidenceContext}`,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          discoveredEvidence: discoveredEvidence as EvidenceId[],
          stressLevel: stress,
        },
        (parsed) => {
          if (parsed.type === "meta") {
            increaseStress(selectedSuspect, parsed.stressImpact);
          } else if (parsed.type === "token" && parsed.text) {
            fullResponse += parsed.text;
            setDisplayText(fullResponse);
          } else if (parsed.type === "error" && parsed.text) {
            fullResponse += parsed.text;
            setDisplayText(fullResponse);
          }
        },
        { caseId, sessionId, canonicalKillerId, backendSessionToken }
      );
      fullResponse = result.fullText.trim() ? result.fullText : fullResponse;

      const assistantMsg: Message = {
        role: "assistant",
        content:
          fullResponse.trim() ||
          "No reply received. Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY, optional INTERROGATION_LLM_PROVIDER=openai|anthropic|auto, restart dev, check /api/interrogate in Network.",
      };
      addMessages(selectedSuspect, [assistantMsg]);
      if (reassuring) {
        if (contradictoryEvidence.length > 0) {
          increaseStress(selectedSuspect, -7);
        } else if (supportiveEvidence.length > 0) {
          increaseStress(selectedSuspect, -5);
        } else {
          increaseStress(selectedSuspect, -5);
        }
      } else if (contradictoryEvidence.length > 0) {
        increaseStress(selectedSuspect, 6);
      } else if (supportiveEvidence.length > 0) {
        increaseStress(selectedSuspect, -4);
      }
      recordInterrogationTurnOutcome(selectedSuspect, text);
      setDisplayText("");
      speakText(fullResponse);
    } catch {
      finalizeSpeechPlayback();
      setDisplayText("");
      addMessages(selectedSuspect, [{
        role: "assistant",
        content: `${suspect.name} falls silent. The connection was lost.`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [
      input,
    loading,
    messages,
    selectedSuspect,
    discoveredEvidence,
    stress,
    addMessages,
    increaseStress,
    speakText,
    suspect,
    caseId,
    sessionId,
    canonicalKillerId,
    backendSessionToken,
    contradictoryEvidence,
    finalizeSpeechPlayback,
    recordInterrogationTurnOutcome,
    supportiveEvidence,
  ]);

  if (!selectedSuspect || !suspect) {
    goTo("manor");
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const suggested = [...(INTERROGATION_SUGGESTED_QUESTIONS[selectedSuspect] ?? [])];
  const highStressQs =
    stress >= INTERROGATION_STRESS_FOLLOWUP_THRESHOLD
      ? [...(INTERROGATION_STRESS_FOLLOWUP_QUESTIONS[selectedSuspect] ?? [])]
      : [];
  const bottomStressHint = interrogationBottomStressHint(stress);

  /** Prefer AI chips (opening + transcript); static only if API empty/offline. */
  const mergedSuggestionChips = useMemo(() => {
    const seen = new Set<string>();
    const add = (q: string, kind: "context" | "static") => {
      const k = q.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      return { q: q.trim(), kind };
    };
    const out: { q: string; kind: "context" | "static" }[] = [];
    for (const q of contextFollowUps) {
      const row = add(q, "context");
      if (row) out.push(row);
    }
    if (contextFollowUps.length > 0) {
      return out.slice(0, MAX_VISIBLE_SUGGESTION_CHIPS);
    }
    for (const q of [...suggested, ...highStressQs]) {
      const row = add(q, "static");
      if (row) out.push(row);
    }
    return out.slice(0, MAX_VISIBLE_SUGGESTION_CHIPS);
  }, [contextFollowUps, suggested, highStressQs]);

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <button
          onClick={() => goTo("manor")}
          className="text-[10px] tracking-wider uppercase text-[#445566] hover:text-[#C8D0DC] transition-colors"
        >
          ← Manor
        </button>
        <div className="text-[10px] tracking-[3px] uppercase text-[#D4A843]">Interrogation Room</div>
        <div className="flex items-center gap-2">
          <div className="text-[9px] text-[#445566]">
            {interrogationStressTopBarLabel(stress)}
          </div>
          <div className="w-20 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${stress}%`,
                background: interrogationStressBarColor(stress),
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Character panel: placeholder 3D (chair / table / evidence) + name strip */}
        <div className="relative flex w-[36%] flex-shrink-0 flex-col border-r border-white/5 h-full min-h-0">
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background: stressed
                ? "radial-gradient(ellipse at 50% 25%, rgba(200,80,40,.12) 0%, transparent 55%)"
                : "radial-gradient(ellipse at 50% 25%, rgba(255,248,200,.06) 0%, transparent 55%)",
            }}
          />
          <div className="relative z-0 min-h-0 flex-1">
            <InterrogationRoomScene3D
              suspectId={selectedSuspect}
              evidenceIds={discoveredEvidence}
              speaking={speaking}
              stressed={stressed}
              characterTimestamps={characterTimestamps}
              visemeTimeline={visemeTimeline}
              speechElapsedMs={speechElapsedMs}
            />
          </div>
          <SuspectMetaFooter suspectId={selectedSuspect} stressed={stressed} />
          {speaking && (
            <div className="absolute top-4 right-4 z-20 flex gap-1 items-end">
              {[4, 7, 5, 8, 4].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 rounded-full bg-[#D4A843]"
                  style={{ height: h, animation: `bounce ${0.4 + i * 0.1}s ease-in-out infinite alternate` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dialogue + evidence panel */}
        <div className="flex flex-1 min-w-0">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {contradictoryEvidence.length > 0 && (
                <div className="rounded-md border border-[#5B3B30] bg-[#2A1715] px-3 py-2 text-[10px] leading-relaxed tracking-[0.02em] text-[#D9A08E]">
                  {hasInterrogationMessages
                    ? "Loaded evidence contradicts what they’ve said in this interview."
                    : "Loaded evidence cuts against this suspect’s story in the case file. Press them once the conversation starts."}
                </div>
              )}

              {supportiveEvidence.length > 0 && contradictoryEvidence.length === 0 && (
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed tracking-[0.02em] text-[#8FA1B8]">
                  {hasInterrogationMessages
                    ? "Selected evidence lines up with what they’ve claimed here."
                    : "Selected evidence aligns with their known account in the file — use it to test details once you begin."}
                </div>
              )}

              {messages.length === 0 && !displayText && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                  <div className="text-[10px] tracking-[3px] uppercase text-[#D4A843]">
                    {suspect.name}
                  </div>
                  <p
                    className="text-xs italic text-[#445566] max-w-xs leading-relaxed"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {INTERROGATION_EMPTY_STATE_INTRO[selectedSuspect]}
                  </p>
                  <p className="text-[9px] text-[#334455]">Type your question below</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className="flex" style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "user" ? (
                    <div
                      className="max-w-[80%] px-3 py-2 rounded-[8px_8px_2px_8px] text-xs leading-relaxed"
                      style={{ background: "rgba(212,168,67,.1)", border: "1px solid rgba(212,168,67,.2)", color: "#D4A843" }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className="max-w-[82%] px-3 py-2 rounded-[8px_8px_8px_2px] text-xs leading-relaxed"
                      style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", color: "#C8D0DC", fontFamily: "Georgia, serif" }}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {displayText && (
                <div className="flex justify-start">
                  <div
                    className="max-w-[82%] px-3 py-2 rounded-[8px_8px_8px_2px] text-xs leading-relaxed"
                    style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", color: "#C8D0DC", fontFamily: "Georgia, serif" }}
                  >
                    {displayText}
                    <span className="inline-block w-px h-3 bg-[#C8D0DC] ml-0.5 align-middle" style={{ animation: "blink .8s step-end infinite" }} />
                  </div>
                </div>
              )}

              {loading && !displayText && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 text-[11px] italic text-[#334455]">
                    {suspect.name.split(" ")[0]} considers...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-white/5 px-4 py-3">
              {bottomStressHint && (
                <div className="mb-2 text-[9px] tracking-wider uppercase text-[#FF9800] opacity-70">
                  {bottomStressHint}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder={`Ask ${suspect.name.split(" ").slice(-1)[0]} anything...`}
                  className="flex-1 bg-transparent border rounded-md px-3 py-2 text-xs outline-none transition-colors placeholder:text-[#334455] disabled:opacity-40"
                  style={{ borderColor: loading ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.12)", color: "#C8D0DC", fontFamily: "Georgia, serif" }}
                  autoFocus
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-30"
                  style={{ background: "rgba(212,168,67,.12)", border: "1px solid rgba(212,168,67,.3)", color: "#D4A843" }}
                >
                  Ask →
                </button>
              </div>

              {/* Suggested questions — max 4, white text; new AI batch only after MIN_SUGGESTION_USES_BEFORE_REFRESH chip uses */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {followUpsLoading ? (
                  <span className="text-[9px] italic text-[#B8C4D0] px-1 transition-opacity duration-300">
                    Updating suggestions…
                  </span>
                ) : null}
                {mergedSuggestionChips.map(({ q, kind }, i) => (
                  <button
                    key={`${kind}-${i}-${q.slice(0, 24)}`}
                    type="button"
                    onClick={() => {
                      suggestionUsesSinceBatchRef.current += 1;
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    disabled={loading}
                    className="text-[10px] px-2.5 py-1 rounded-md text-left max-w-[100%] transition-all duration-200 disabled:opacity-30 hover:bg-white/[0.06]"
                    style={{
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.1)",
                      color: "#E8ECF3",
                    }}
                    title={
                      kind === "context"
                        ? "Suggested from this chat and what you’ve found — not the final answer"
                        : "Fallback prompt if suggestions are unavailable"
                    }
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <EvidenceBoard />
        </div>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes bounce { from { transform: scaleY(0.5); } to { transform: scaleY(1.5); } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }
      `}</style>
    </motion.div>
  );
}
