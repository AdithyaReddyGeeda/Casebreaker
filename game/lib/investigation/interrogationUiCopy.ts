import type { SuspectId } from "@/lib/cases/harlow-manor";

/** Suggested player questions — content only; no game rules. */
/** Fallback only when suggestion API is unavailable — broad, fair-play angles (no solution). */
export const INTERROGATION_SUGGESTED_QUESTIONS: Record<SuspectId, readonly string[]> = {
  fenn: [
    "Walk me through your movements from dinner until you retired.",
    "What had you brought with you to the manor in your professional capacity?",
    "Did anything about last night strike you as out of the ordinary?",
    "How well did you know the household’s usual evening routine?",
  ],
  victoria: [
    "Where were you between nine and ten last night, in as much detail as you can?",
    "What did you understand about Edmund’s intentions for the estate?",
    "Which parts of the house did you pass through after dark?",
    "How would you describe your marriage in recent months?",
  ],
  oliver: [
    "What passed between you and Edmund in the library that evening?",
    "What financial pressures were weighing on you at the time?",
    "Who or what did you see when you left the library?",
    "Where did you go immediately afterward, and who might confirm it?",
  ],
};

/** Extra chips when stress ≥ threshold — still investigatory, not a reveal. */
export const INTERROGATION_STRESS_FOLLOWUP_QUESTIONS: Record<SuspectId, readonly string[]> = {
  fenn: [
    "Is there anything about your bag or supplies we should re-examine?",
    "What might explain a sighting of you near the guest rooms?",
  ],
  victoria: [
    "Help me reconcile what we know about the estate papers with what you’ve said.",
    "What account can you give of your movements outside the main rooms that night?",
  ],
  oliver: [
    "What documentary evidence exists of your debts, and who knew of them?",
    "I need the substance of the quarrel — not the colour, the facts.",
  ],
};

export const INTERROGATION_EMPTY_STATE_INTRO: Record<SuspectId, string> = {
  fenn: "Dr. Fenn sits straight in his chair, hands folded. He meets your gaze without blinking.",
  victoria: "Victoria Harlow is already seated when you enter. She does not look up immediately.",
  oliver: "Oliver is pacing when you arrive. He stops, runs a hand through his hair.",
};

export const INTERROGATION_STRESS_FOLLOWUP_THRESHOLD = 30;
