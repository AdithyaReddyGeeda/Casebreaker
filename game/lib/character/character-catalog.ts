import type { SuspectId } from "@/lib/cases/harlow-manor";
import type { CharacterAsset, CharacterSpec } from "./character-pipeline";

const FRONT_FACING_YAW = -Math.PI / 2;

export interface CharacterCatalogEntry {
  suspectId: SuspectId;
  displayName: string;
  fallbackModelPath: string;
  generatedModelPath: string;
  promptSeed: string;
  preferredYaw?: number;
  spec: CharacterSpec;
}

const STORY_ID = "harlow-manor";

export const CURATED_CHARACTER_CATALOG: CharacterAsset[] = [
  {
    id: "fenn-curated",
    name: "Dr. James Fenn",
    modelUrl: "/models/dr_fenn_tripo.glb",
    source: "curated",
    tags: ["human", "male", "formal", "doctor", "1920s"],
  },
  {
    id: "victoria-curated",
    name: "Victoria Harlow",
    modelUrl: "/models/character.glb",
    source: "curated",
    tags: ["human", "female", "formal", "aristocratic", "1920s"],
  },
  {
    id: "oliver-curated",
    name: "Oliver Harlow",
    modelUrl: "/models/brian.glb",
    source: "curated",
    tags: ["human", "male", "formal", "1920s"],
  },
];

const CHARACTER_CATALOG: Record<SuspectId, CharacterCatalogEntry> = {
  fenn: {
    suspectId: "fenn",
    displayName: "Dr. James Fenn",
    fallbackModelPath: "/models/dr_fenn_tripo.glb",
    generatedModelPath: "/models/generated/fenn-v3.glb",
    promptSeed:
      "single realistic British male physician, age 48, lean build, slightly gaunt face, sharp cheekbones, high forehead, receding dark hair with gray at the temples, tired intelligent eyes, narrow nose, clean-shaven, dark three-piece suit with subtle doctor styling, reserved and clinical, older than Oliver, centered character only",
    preferredYaw: FRONT_FACING_YAW,
    spec: {
      storyId: STORY_ID,
      role: "suspect",
      era: "1920s",
      styleTags: ["human", "male", "formal", "doctor", "interrogation"],
      ageRange: [42, 52],
      genderPresentation: "male",
    },
  },
  victoria: {
    suspectId: "victoria",
    displayName: "Victoria Harlow",
    fallbackModelPath: "/models/character.glb",
    generatedModelPath: "/models/generated/victoria-v2.glb",
    promptSeed:
      "single realistic British woman, 1920s upper-class widow, elegant evening attire, poised but guarded expression, expressive face, animation-friendly human, neutral standing pose, centered character only",
    preferredYaw: FRONT_FACING_YAW,
    spec: {
      storyId: STORY_ID,
      role: "suspect",
      era: "1920s",
      styleTags: ["human", "female", "formal", "aristocratic", "interrogation"],
      ageRange: [38, 46],
      genderPresentation: "female",
    },
  },
  oliver: {
    suspectId: "oliver",
    displayName: "Oliver Harlow",
    fallbackModelPath: "/models/brian.glb",
    generatedModelPath: "/models/generated/oliver-v3.glb",
    promptSeed:
      "single realistic British man, age 28, slim younger build, softer youthful face, tousled medium brown hair, fuller fringe, wide worried eyes, slightly pale skin, clean-shaven, loosened tie, disheveled tailored formalwear, nervous heir energy, visibly younger than Dr. Fenn, centered character only",
    preferredYaw: FRONT_FACING_YAW,
    spec: {
      storyId: STORY_ID,
      role: "suspect",
      era: "1920s",
      styleTags: ["human", "male", "formal", "interrogation"],
      ageRange: [24, 32],
      genderPresentation: "male",
    },
  },
};

export function getCharacterDefinition(suspectId: SuspectId): CharacterCatalogEntry {
  return CHARACTER_CATALOG[suspectId];
}

export function getCharacterModelForSuspect(
  suspectId: SuspectId,
  preferredModelPath?: string | null
): string {
  return preferredModelPath?.trim() || getCharacterDefinition(suspectId).fallbackModelPath;
}

function scoreAsset(spec: CharacterSpec, asset: CharacterAsset): number {
  let score = 0;

  for (const tag of spec.styleTags) {
    if (asset.tags.includes(tag)) score += 2;
  }

  if (spec.genderPresentation !== "unspecified") {
    if (asset.tags.includes(spec.genderPresentation)) score += 2;
  }

  if (asset.tags.includes(spec.era)) score += 1;
  if (asset.tags.includes("human")) score += 2;

  return score;
}

export function matchCuratedCharacter(spec: CharacterSpec): CharacterAsset | null {
  const ranked = CURATED_CHARACTER_CATALOG
    .map((asset) => ({ asset, score: scoreAsset(spec, asset) }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length || ranked[0].score <= 0) return null;
  return ranked[0].asset;
}
