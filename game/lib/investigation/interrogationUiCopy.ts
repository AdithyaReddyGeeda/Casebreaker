import type { SuspectId } from "@/lib/cases/harlow-manor";

/** Suggested player questions — content only; no game rules. */
export const INTERROGATION_SUGGESTED_QUESTIONS: Record<SuspectId, readonly string[]> = {
  fenn: [
    "Where were you when Edmund died?",
    "Tell me about your medical bag.",
    "Did you notice anything unusual last night?",
    "What is your relationship with Victoria Harlow?",
  ],
  victoria: [
    "Where were you between 9 and 10 PM?",
    "Tell me about Edmund's will.",
    "Did you enter the guest wing last night?",
    "How would you describe your marriage?",
  ],
  oliver: [
    "Tell me about your argument with Edmund.",
    "What do you owe the moneylenders?",
    "Did you see anyone when you left the library?",
    "Where were you after leaving Edmund?",
  ],
};

/** Extra chips when stress ≥ threshold (see InterrogationRoom). */
export const INTERROGATION_STRESS_FOLLOWUP_QUESTIONS: Record<SuspectId, readonly string[]> = {
  fenn: ["I know about your feelings for Victoria.", "A strychnine vial is missing from your bag."],
  victoria: ["The amended will cuts you out entirely.", "You were seen in the guest wing at 9:10 PM."],
  oliver: ["We found your debt letter.", "What exactly did you argue about?"],
};

export const INTERROGATION_EMPTY_STATE_INTRO: Record<SuspectId, string> = {
  fenn: "Dr. Fenn sits straight in his chair, hands folded. He meets your gaze without blinking.",
  victoria: "Victoria Harlow is already seated when you enter. She does not look up immediately.",
  oliver: "Oliver is pacing when you arrive. He stops, runs a hand through his hair.",
};

export const INTERROGATION_STRESS_FOLLOWUP_THRESHOLD = 30;
