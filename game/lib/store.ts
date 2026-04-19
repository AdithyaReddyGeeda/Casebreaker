import { create } from "zustand";
import { HARLOW_MANOR } from "./cases/harlow-manor";
import type {
  Evidence as CaseEvidence,
  Suspect,
  SuspectId,
  EvidenceId,
  RoomId,
} from "./cases/harlow-manor";
import {
  buildEvidenceExaminationDetail,
  createLocalInvestigationHydration,
  executeAccusationSubmission,
  mergeExaminedEvidenceIds,
  mergeUnlockedFactIds,
  runInterrogationContradictionEngine,
  stressDeltaForNewContradictions,
  tryAugmentBackendSession,
} from "@/lib/investigation";
import type { Evidence as GameEvidence } from "@/lib/evidence/types";
import { createMockEvidence } from "@/lib/evidence/sampleEvidence";
import type {
  AccusationSubmissionMeta,
  CaseSessionRunSource,
  VerdictResult,
  ContradictionEvent,
  ResolvedVerdict,
} from "@/lib/investigation";
import {
  DEFAULT_CANONICAL_CASE_FACTS,
  type AccusationStatus,
  type CanonicalCaseFacts,
  type SuspectCanonicalState,
  type VerdictStatus,
} from "./investigationCanonical";

export type Screen =
  | "intro"
  | "cinematic"
  | "manor"
  | "room"
  | "evidence"
  | "interrogation"
  | "accusation"
  | "verdict";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type { VerdictResult };

function initialSuspectStates(): Record<SuspectId, SuspectCanonicalState> {
  return {
    fenn: { stress: 0, interrogationMessageCount: 0 },
    victoria: { stress: 0, interrogationMessageCount: 0 },
    oliver: { stress: 0, interrogationMessageCount: 0 },
  };
}

function defaultActiveCaseEntities(): { activeSuspects: Suspect[]; activeEvidence: CaseEvidence[] } {
  return {
    activeSuspects: HARLOW_MANOR.suspects.map((s) => ({ ...s })),
    activeEvidence: HARLOW_MANOR.evidence.map((e) => ({ ...e })),
  };
}

export interface GameState {
  screen: Screen;
  selectedRoom: RoomId | null;
  selectedSuspect: SuspectId | null;
  discoveredEvidence: EvidenceId[];
  discoveredEvidenceAt: Partial<Record<EvidenceId, number>>;
  searchedRooms: RoomId[];
  suspectStress: Record<SuspectId, number>;
  interrogationHistories: Record<SuspectId, Message[]>;
  accusation: VerdictResult | null;
  gameStartTime: number | null;

  /** Set when the player begins a run (first entry to cinematic). */
  sessionId: string | null;
  /** Active case identifier for this build. */
  caseId: string;
  sessionStartedAt: number | null;
  /** Ground truth from the case file — not generated dialogue. */
  canonicalCaseFacts: CanonicalCaseFacts;
  /** Evidence the player has formally examined (subset of discovery flow). */
  examinedEvidenceIds: EvidenceId[];
  /** Canonical fact keys unlocked by examining evidence (deterministic). */
  unlockedCanonicalFactIds: string[];
  contradictionHistory: ContradictionEvent[];
  /** Per-suspect canonical state; `stress` mirrors `suspectStress`. */
  suspectStates: Record<SuspectId, SuspectCanonicalState>;
  accusationStatus: AccusationStatus;
  verdictStatus: VerdictStatus;
  /** Populated when a verdict is resolved; canonical bundle for scoring / replay. */
  resolvedVerdict: ResolvedVerdict | null;
  /** Audit trail for the last accusation (session, evidence, contradictions at submit time). */
  accusationSubmissionMeta: AccusationSubmissionMeta | null;
  /** Active case roster (hydrated on session start; mirrors shipped case for this build). */
  activeSuspects: Suspect[];
  activeEvidence: CaseEvidence[];
  evidence: GameEvidence[];
  selectedEvidenceIds: string[];
  pinnedEvidenceIds: EvidenceId[];
  /** Optional FastAPI session token when `NEXT_PUBLIC_CASEBREAKER_API_URL` succeeds. */
  backendSessionToken: string | null;
  caseRunSource: CaseSessionRunSource;

  goTo: (screen: Screen) => void;
  selectRoom: (roomId: RoomId) => void;
  searchRoom: (roomId: RoomId, evidenceIds: EvidenceId[]) => void;
  selectSuspect: (suspectId: SuspectId) => void;
  discoverEvidence: (evidenceId: EvidenceId) => void;
  /** Formal examination (e.g. opening a card); idempotent if already examined. */
  registerEvidenceExamination: (evidenceId: EvidenceId) => void;
  toggleEvidenceSelection: (id: string) => void;
  markEvidenceReviewed: (id: string) => void;
  setEvidenceForAccusation: (id: string, value: boolean) => void;
  updateEvidenceImage: (
    id: string,
    patch: Partial<Pick<GameEvidence, "imageUrl" | "imagePrompt" | "imageStatus">>
  ) => void;
  togglePinnedEvidence: (evidenceId: EvidenceId) => void;
  increaseStress: (suspectId: SuspectId, amount: number) => void;
  addMessages: (suspectId: SuspectId, msgs: Message[]) => void;
  submitAccusation: (suspectId: SuspectId, reasoning: string) => void;
  /** After each reply: contradiction engine (canonical facts + evidence; model text is heuristic only). */
  recordInterrogationTurnOutcome: (suspectId: SuspectId, userMessage: string) => void;
  resetGame: () => void;
}

const defaultStress: Record<SuspectId, number> = {
  fenn: 0,
  victoria: 0,
  oliver: 0,
};

/** Keeps `suspectStress` and `suspectStates.*.stress` in sync (single write path). */
function patchSuspectStress(
  s: GameState,
  suspectId: SuspectId,
  nextStress: number
): Pick<GameState, "suspectStress" | "suspectStates"> {
  return {
    suspectStress: { ...s.suspectStress, [suspectId]: nextStress },
    suspectStates: {
      ...s.suspectStates,
      [suspectId]: { ...s.suspectStates[suspectId], stress: nextStress },
    },
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: "intro",
  selectedRoom: null,
  selectedSuspect: null,
  discoveredEvidence: [],
  discoveredEvidenceAt: {},
  searchedRooms: [],
  suspectStress: { ...defaultStress },
  interrogationHistories: {
    fenn: [],
    victoria: [],
    oliver: [],
  },
  accusation: null,
  gameStartTime: null,

  sessionId: null,
  caseId: DEFAULT_CANONICAL_CASE_FACTS.caseId,
  sessionStartedAt: null,
  canonicalCaseFacts: DEFAULT_CANONICAL_CASE_FACTS,
  examinedEvidenceIds: [],
  unlockedCanonicalFactIds: [],
  contradictionHistory: [],
  suspectStates: initialSuspectStates(),
  accusationStatus: "none",
  verdictStatus: "none",
  resolvedVerdict: null,
  accusationSubmissionMeta: null,
  ...defaultActiveCaseEntities(),
  evidence: createMockEvidence(),
  selectedEvidenceIds: [],
  pinnedEvidenceIds: [],
  backendSessionToken: null,
  caseRunSource: "local",

  goTo: (screen) => {
    set((s) => {
      const firstCinematic = screen === "cinematic" && !s.gameStartTime;
      if (firstCinematic) {
        const h = createLocalInvestigationHydration();
        // Optional FastAPI session token for backend interrogation adapter; non-blocking.
        void tryAugmentBackendSession().then((aug) => {
          if (aug) {
            set({
              backendSessionToken: aug.token,
              caseRunSource: aug.source,
            });
          }
        });
        return {
          screen,
          gameStartTime: Date.now(),
          sessionId: h.session.sessionId,
          sessionStartedAt: h.session.startedAt,
          caseId: h.caseId,
          canonicalCaseFacts: h.canonicalCaseFacts,
          activeSuspects: h.suspects,
          activeEvidence: h.evidence,
          evidence: createMockEvidence(),
          selectedEvidenceIds: [],
          backendSessionToken: null,
          caseRunSource: "local",
        };
      }
      return {
        screen,
        gameStartTime: s.gameStartTime,
      };
    });
  },

  selectRoom: (roomId) => set({ selectedRoom: roomId }),

  searchRoom: (roomId, evidenceIds) => {
    set((s) => {
      const newlyFound = evidenceIds.filter((id) => !s.discoveredEvidence.includes(id));
      let examined = s.examinedEvidenceIds;
      let unlocked = s.unlockedCanonicalFactIds;
      for (const id of newlyFound) {
        examined = mergeExaminedEvidenceIds(examined, id);
        const detail = buildEvidenceExaminationDetail(id, s.canonicalCaseFacts);
        unlocked = mergeUnlockedFactIds(unlocked, detail.unlockedFactIds);
      }
      const nextDiscoveredEvidenceAt = { ...s.discoveredEvidenceAt };
      const now = Date.now();
      for (const id of newlyFound) {
        nextDiscoveredEvidenceAt[id] ??= now;
      }
      return {
        searchedRooms: s.searchedRooms.includes(roomId)
          ? s.searchedRooms
          : [...s.searchedRooms, roomId],
        discoveredEvidence: [...s.discoveredEvidence, ...newlyFound],
        discoveredEvidenceAt: nextDiscoveredEvidenceAt,
        examinedEvidenceIds: examined,
        unlockedCanonicalFactIds: unlocked,
      };
    });
  },

  selectSuspect: (suspectId) => set({ selectedSuspect: suspectId }),

  discoverEvidence: (evidenceId) => {
    set((s) => {
      if (s.discoveredEvidence.includes(evidenceId)) return {};
      const detail = buildEvidenceExaminationDetail(evidenceId, s.canonicalCaseFacts);
      return {
        discoveredEvidence: [...s.discoveredEvidence, evidenceId],
        discoveredEvidenceAt: {
          ...s.discoveredEvidenceAt,
          [evidenceId]: s.discoveredEvidenceAt[evidenceId] ?? Date.now(),
        },
        examinedEvidenceIds: mergeExaminedEvidenceIds(s.examinedEvidenceIds, evidenceId),
        unlockedCanonicalFactIds: mergeUnlockedFactIds(
          s.unlockedCanonicalFactIds,
          detail.unlockedFactIds
        ),
      };
    });
  },

  togglePinnedEvidence: (evidenceId) => {
    set((s) => ({
      pinnedEvidenceIds: s.pinnedEvidenceIds.includes(evidenceId)
        ? s.pinnedEvidenceIds.filter((id) => id !== evidenceId)
        : [...s.pinnedEvidenceIds, evidenceId],
    }));
  },

  registerEvidenceExamination: (evidenceId) => {
    set((s) => {
      if (!s.discoveredEvidence.includes(evidenceId)) return {};
      if (s.examinedEvidenceIds.includes(evidenceId)) return {};
      const detail = buildEvidenceExaminationDetail(evidenceId, s.canonicalCaseFacts);
      return {
        examinedEvidenceIds: mergeExaminedEvidenceIds(s.examinedEvidenceIds, evidenceId),
        unlockedCanonicalFactIds: mergeUnlockedFactIds(
          s.unlockedCanonicalFactIds,
          detail.unlockedFactIds
        ),
      };
    });
  },

  toggleEvidenceSelection: (id) => {
    set((s) => ({
      selectedEvidenceIds: s.selectedEvidenceIds.includes(id)
        ? s.selectedEvidenceIds.filter((entry) => entry !== id)
        : [...s.selectedEvidenceIds, id],
    }));
  },

  markEvidenceReviewed: (id) => {
    set((s) => {
      const nextEvidence = s.evidence.map((item) =>
        item.id === id && item.status !== "Key Evidence"
          ? { ...item, status: "Reviewed" as const }
          : item
      );
      return {
        evidence: nextEvidence,
      };
    });
  },

  setEvidenceForAccusation: (id, value) => {
    set((s) => {
      const nextEvidence = s.evidence.map((item) =>
        item.id === id ? { ...item, selectedForAccusation: value } : item
      );
      return {
        evidence: nextEvidence,
      };
    });
  },

  updateEvidenceImage: (id, patch) => {
    set((s) => ({
      evidence: s.evidence.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  },

  increaseStress: (suspectId, amount) => {
    set((s) => {
      const next = Math.max(0, Math.min(100, (s.suspectStress[suspectId] ?? 0) + amount));
      return patchSuspectStress(s, suspectId, next);
    });
  },

  addMessages: (suspectId, msgs) => {
    set((s) => {
      const nextHist = [...(s.interrogationHistories[suspectId] ?? []), ...msgs];
      return {
        interrogationHistories: {
          ...s.interrogationHistories,
          [suspectId]: nextHist,
        },
        suspectStates: {
          ...s.suspectStates,
          [suspectId]: {
            ...s.suspectStates[suspectId],
            interrogationMessageCount: nextHist.length,
          },
        },
      };
    });
  },

  submitAccusation: (suspectId, reasoning) => {
    const s = get();
    const result = executeAccusationSubmission({
      suspectId,
      reasoning,
      discoveredEvidenceIds: s.discoveredEvidence,
      examinedEvidenceIds: s.examinedEvidenceIds,
      canonicalKillerId: s.canonicalCaseFacts.killerId,
      contradictionHistory: s.contradictionHistory,
      caseId: s.caseId,
      sessionId: s.sessionId,
      sessionStartedAt: s.sessionStartedAt,
      unlockedCanonicalFactIds: s.unlockedCanonicalFactIds,
    });
    const selectedAccusationEvidence = s.evidence.filter((item) => item.selectedForAccusation);
    const hasRequiredKeyEvidence = selectedAccusationEvidence.some(
      (item) => item.isKey && item.contradicts.includes(suspectId)
    );
    const verdict = {
      ...result.verdict,
      correct: result.verdict.correct && hasRequiredKeyEvidence,
    };
    set({
      accusation: verdict,
      accusationStatus: "submitted",
      verdictStatus: "resolved",
      resolvedVerdict: {
        ...result.resolvedVerdict,
        correct: verdict.correct,
      },
      accusationSubmissionMeta: result.submissionMeta,
    });
  },

  recordInterrogationTurnOutcome: (suspectId, userMessage) => {
    set((s) => {
      const existingIds = new Set(s.contradictionHistory.map((c) => c.id));
      const thread = s.interrogationHistories[suspectId] ?? [];
      const lastAssistant =
        [...thread].reverse().find((m) => m.role === "assistant")?.content ?? "";
      const events = runInterrogationContradictionEngine({
        suspectId,
        userMessage,
        lastAssistantText: lastAssistant,
        discoveredEvidenceIds: s.discoveredEvidence,
        examinedEvidenceIds: s.examinedEvidenceIds,
        canonicalCaseFacts: s.canonicalCaseFacts,
        existingIds,
        baseOrderIndex: s.contradictionHistory.length,
      });
      if (events.length === 0) return {};
      const delta = stressDeltaForNewContradictions(events.length);
      const nextStress = Math.min(100, (s.suspectStress[suspectId] ?? 0) + delta);
      const nextHist = [...s.contradictionHistory, ...events];
      return {
        contradictionHistory: nextHist,
        ...patchSuspectStress(s, suspectId, nextStress),
      };
    });
  },

  resetGame: () =>
    set({
      screen: "intro",
      selectedRoom: null,
      selectedSuspect: null,
      discoveredEvidence: [],
      discoveredEvidenceAt: {},
      searchedRooms: [],
      suspectStress: { ...defaultStress },
      interrogationHistories: { fenn: [], victoria: [], oliver: [] },
      accusation: null,
      gameStartTime: null,
      sessionId: null,
      caseId: DEFAULT_CANONICAL_CASE_FACTS.caseId,
      sessionStartedAt: null,
      canonicalCaseFacts: DEFAULT_CANONICAL_CASE_FACTS,
      examinedEvidenceIds: [],
      unlockedCanonicalFactIds: [],
      contradictionHistory: [],
      suspectStates: initialSuspectStates(),
      accusationStatus: "none",
      verdictStatus: "none",
      resolvedVerdict: null,
      accusationSubmissionMeta: null,
      ...defaultActiveCaseEntities(),
      evidence: createMockEvidence(),
      selectedEvidenceIds: [],
      pinnedEvidenceIds: [],
      backendSessionToken: null,
      caseRunSource: "local",
    }),
}));
