import { getSuspect, type SuspectId } from "@/lib/cases/harlow-manor";
import { getCharacterDefinition } from "./character-catalog";

const BASE_PROMPT_SUFFIX =
  "single realistic full-body human character only, centered, readable silhouette, expressive face, clean topology, animation friendly if possible, neutral standing pose, feet on ground, human scale, isolated subject, no props, no furniture, no table, no chair, no accessories beyond clothing, no environment, no room, no background scene";

export function buildCharacterStoryId(caseId: string, suspectId: SuspectId): string {
  return `${caseId}:${suspectId}`;
}

export function buildCharacterPromptForSuspect(suspectId: SuspectId): string {
  const suspect = getSuspect(suspectId);
  const definition = getCharacterDefinition(suspectId);

  return [
    definition.promptSeed,
    `name: ${suspect.name}`,
    `age: ${suspect.age}`,
    `occupation: ${suspect.occupation}`,
    `relationship: ${suspect.relationship}`,
    `personality: ${suspect.personality}`,
    BASE_PROMPT_SUFFIX,
  ].join(", ");
}

export function getFallbackModelForSuspect(suspectId: SuspectId): string {
  return getCharacterDefinition(suspectId).fallbackModelPath;
}
