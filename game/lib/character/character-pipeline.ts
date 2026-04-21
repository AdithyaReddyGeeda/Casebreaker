import type { SuspectId } from "@/lib/cases/harlow-manor";

export type LipRigType = "morphTargets" | "jawBone" | "none";
export type CharacterMotionMode = "viseme" | "jaw" | "rigid";

export interface CharacterSpec {
  storyId: string;
  role: "suspect" | "witness" | "detective" | "custom";
  era: string;
  styleTags: string[];
  ageRange: [number, number];
  genderPresentation: "male" | "female" | "androgynous" | "unspecified";
}

export interface CharacterAsset {
  id: string;
  name: string;
  modelUrl: string;
  source: "curated" | "generated";
  tags: string[];
}

export interface RigReport {
  lipRig: LipRigType;
  hasHeadBone: boolean;
  hasMorphTargets: boolean;
  hasJawBone: boolean;
  morphTargetCount: number;
  issues: string[];
}

export interface VisemeEvent {
  timeMs: number;
  viseme: string;
  strength: number;
}

export interface VisemeTimeline {
  provider: string;
  durationMs: number;
  events: VisemeEvent[];
}

export interface CharacterTimestampRange {
  char: string;
  startMs: number;
  endMs: number;
}

export interface ResolvedCharacterModel {
  suspectId: SuspectId;
  modelPath: string;
  source: "fallback" | "local-cache" | "tripo";
  motionMode: CharacterMotionMode;
  rigReport: RigReport | null;
  prompt?: string;
  generatedAtIso?: string;
  taskId?: string;
}

export const DEFAULT_CHARACTER_SPEC: Omit<CharacterSpec, "storyId"> = {
  role: "suspect",
  era: "1920s",
  styleTags: ["human", "interrogation", "formal"],
  ageRange: [30, 55],
  genderPresentation: "unspecified",
};

export function makeStorySpec(
  storyId: string,
  overrides?: Partial<Omit<CharacterSpec, "storyId">>
): CharacterSpec {
  return {
    storyId,
    ...DEFAULT_CHARACTER_SPEC,
    ...overrides,
    styleTags: overrides?.styleTags?.length
      ? overrides.styleTags
      : DEFAULT_CHARACTER_SPEC.styleTags,
    ageRange: overrides?.ageRange ?? DEFAULT_CHARACTER_SPEC.ageRange,
  };
}

export function approxVisemeTimelineFromText(
  text: string,
  provider: string,
  msPerChar = 55
): VisemeTimeline {
  const cleaned = text.trim();
  const durationMs = Math.max(1200, cleaned.length * msPerChar);
  const chunkSize = 3;
  const events: VisemeEvent[] = [];
  const visemeCycle = ["aa", "eh", "oh", "ih", "ou"];

  for (let i = 0; i < cleaned.length; i += chunkSize) {
    const ratio = cleaned.length === 0 ? 0 : i / cleaned.length;
    const timeMs = Math.round(ratio * durationMs);
    const char = cleaned[i]?.toLowerCase() ?? "a";
    let viseme = visemeCycle[i % visemeCycle.length];

    if ("aeiou".includes(char)) {
      viseme = `${char}${char}`;
    }

    const strength = 0.45 + ((i / chunkSize) % 3) * 0.15;
    events.push({
      timeMs,
      viseme,
      strength: Math.min(1, strength),
    });
  }

  return { provider, durationMs, events };
}

export function buildCharacterTimestampsFromText(
  text: string,
  durationMs: number
): CharacterTimestampRange[] {
  const chars = Array.from(text);
  if (!chars.length) return [];

  const perChar = Math.max(20, durationMs / chars.length);
  return chars.map((char, index) => ({
    char,
    startMs: Math.round(index * perChar),
    endMs: Math.round((index + 1) * perChar),
  }));
}
