/**
 * Tripo AI Prompt Templates
 *
 * Pre-built prompt structures for generating high-quality 3D models from story descriptions.
 * Use these templates to create consistent, production-ready Tripo prompts.
 *
 * Workflow:
 * 1. Fill in story details (character traits, environment, objects)
 * 2. Generate Tripo prompt using template
 * 3. Submit to Tripo API or web interface
 * 4. Download .glb file
 * 5. Import into Three.js scene
 */

export interface SuspectDescription {
  name: string;
  age: number;
  ethnicity?: string;
  gender: "male" | "female" | "non-binary";
  emotion: "calm" | "nervous" | "angry" | "confused" | "sad" | "stressed";
  appearance: {
    facialFeatures?: string; // "sharp jawline", "round face", "prominent nose"
    expression?: string; // "stern", "fearful", "guilty"
    scars?: string;
    tattoos?: string;
    distinctive?: string;
  };
  clothing?: string;
  hairstyle?: string;
}

export interface RoomDescription {
  type: "interrogation" | "police_station" | "office" | "residence";
  size: "small" | "medium" | "large";
  style: "modern" | "vintage" | "industrial" | "minimalist";
  mood: "tense" | "professional" | "gritty" | "sterile";
  features?: {
    walls?: string;
    floor?: string;
    ceiling?: string;
    lighting?: string;
    windows?: string;
  };
  furniture?: string[]; // ["metal table", "wooden chairs", "filing cabinet"]
  details?: string[]; // ["coffee stains", "scuffed paint", "surveillance camera"]
  timeperiod?: string; // "1970s", "modern day", "noir"
}

export interface EvidenceDescription {
  name: string;
  type: "document" | "weapon" | "object" | "photo" | "clothing";
  color?: string;
  material?: string;
  condition: "pristine" | "worn" | "damaged" | "bloodstained";
  detail?: string;
}

// ========== SUSPECT HEAD PROMPT TEMPLATE ==========
export const generateSuspectPrompt = (suspect: SuspectDescription): string => {
  const emotion_descriptors: Record<string, string> = {
    calm: "peaceful, composed, confident",
    nervous: "anxious, tense, worried, eyebrows raised",
    angry: "furious, aggressive, scowling",
    confused: "bewildered, perplexed, frowning",
    sad: "sorrowful, melancholic, downcast",
    stressed: "stressed, worn-out, haggard",
  };

  const parts = [
    `Photorealistic 3D human head model`,
    `Name: ${suspect.name}, Age: ${suspect.age}`,
    `Gender: ${suspect.gender}`,
    `${suspect.ethnicity ? `Ethnicity: ${suspect.ethnicity}` : ""}`,
    `Facial Expression: ${emotion_descriptors[suspect.emotion]}`,
    suspect.appearance.expression ? `Expression details: ${suspect.appearance.expression}` : "",
    suspect.appearance.facialFeatures ? `Face shape: ${suspect.appearance.facialFeatures}` : "",
    suspect.appearance.scars ? `Scars: ${suspect.appearance.scars}` : "",
    suspect.appearance.tattoos ? `Visible tattoos: ${suspect.appearance.tattoos}` : "",
    suspect.appearance.distinctive ? `Distinctive features: ${suspect.appearance.distinctive}` : "",
    suspect.hairstyle ? `Hairstyle: ${suspect.hairstyle}` : "",
    `High quality, photorealistic, detailed facial features, suitable for interrogation game`,
    `Professional lighting, neutral background, front-facing view`,
  ];

  return parts.filter(p => p).join(". ") + ".";
};

// ========== INTERROGATION ROOM PROMPT TEMPLATE ==========
export const generateRoomPrompt = (room: RoomDescription): string => {
  const mood_descriptors: Record<string, string> = {
    tense: "oppressive, claustrophobic, threatening atmosphere",
    professional: "corporate, clean, orderly",
    gritty: "rough, worn, urban decay",
    sterile: "clinical, bare minimum, institutional",
  };

  const furniture_list = room.furniture?.join(", ") || "basic furniture";
  const details_list = room.details?.join(", ") || "none";

  const parts = [
    `3D Model: ${room.type === "interrogation" ? "Police Interrogation Room" : "Detailed Interior Room"}`,
    `Size: ${room.size}`,
    `Style: ${room.style}`,
    `Mood: ${mood_descriptors[room.mood]}`,
    room.features?.walls ? `Walls: ${room.features.walls}` : "Walls: concrete or painted drywall",
    room.features?.floor ? `Floor: ${room.features.floor}` : "Floor: linoleum or tile",
    room.features?.ceiling ? `Ceiling: ${room.features.ceiling}` : "Ceiling: drop tile or exposed",
    room.features?.lighting ? `Lighting: ${room.features.lighting}` : "Lighting: fluorescent, dim",
    room.features?.windows ? `Windows: ${room.features.windows}` : "Windows: none or barred",
    `Furniture: ${furniture_list}`,
    `Details: ${details_list}`,
    room.timeperiod ? `Time period: ${room.timeperiod}` : "",
    `Photorealistic, high-detail, ready for game integration`,
    `Complete room layout, suitable for 3D game environment`,
  ];

  return parts.filter(p => p).join(". ") + ".";
};

// ========== EVIDENCE OBJECT PROMPT TEMPLATE ==========
export const generateEvidencePrompt = (evidence: EvidenceDescription): string => {
  const condition_descriptors: Record<string, string> = {
    pristine: "brand new, perfect condition, clean",
    worn: "aged, used, shows signs of wear",
    damaged: "broken, torn, heavily damaged",
    bloodstained: "with dried bloodstains, evidence of violence",
  };

  const parts = [
    `3D Model: ${evidence.type} - ${evidence.name}`,
    evidence.color ? `Color: ${evidence.color}` : "",
    evidence.material ? `Material: ${evidence.material}` : "",
    `Condition: ${condition_descriptors[evidence.condition]}`,
    evidence.detail ? `Details: ${evidence.detail}` : "",
    `High-quality detail, photorealistic`,
    `Suitable for close-up examination in game`,
    `Appropriate scale for table placement`,
  ];

  return parts.filter(p => p).join(". ") + ".";
};

// ========== COMPLETE SCENARIO PROMPT ==========
export interface ScenarioDescription {
  title: string;
  suspects: SuspectDescription[];
  room: RoomDescription;
  evidence: EvidenceDescription[];
  narrative?: string;
}

export const generateCompleteScenarioPrompts = (
  scenario: ScenarioDescription
): {
  suspects: Record<string, string>;
  room: string;
  evidence: Record<string, string>;
} => {
  return {
    suspects: scenario.suspects.reduce(
      (acc, suspect) => {
        acc[suspect.name] = generateSuspectPrompt(suspect);
        return acc;
      },
      {} as Record<string, string>
    ),
    room: generateRoomPrompt(scenario.room),
    evidence: scenario.evidence.reduce(
      (acc, item) => {
        acc[item.name] = generateEvidencePrompt(item);
        return acc;
      },
      {} as Record<string, string>
    ),
  };
};

// ========== EXAMPLE SCENARIO ==========
export const EXAMPLE_INTERROGATION_SCENARIO: ScenarioDescription = {
  title: "The Garden Party Murder",
  suspects: [
    {
      name: "Victoria Harlow",
      age: 34,
      ethnicity: "British",
      gender: "female",
      emotion: "nervous",
      appearance: {
        facialFeatures: "high cheekbones, sharp features",
        expression: "guilt-ridden, avoiding eye contact",
        distinctive: "scar on left temple",
      },
      hairstyle: "dark brown, shoulder-length",
      clothing: "expensive silk blouse, pearl necklace",
    },
    {
      name: "Oliver Crane",
      age: 42,
      gender: "male",
      emotion: "angry",
      appearance: {
        facialFeatures: "strong jaw, intense eyes",
        expression: "defensive, clenched jaw",
      },
      hairstyle: "salt-and-pepper, slicked back",
      clothing: "tailored suit, tie loosened",
    },
  ],
  room: {
    type: "interrogation",
    size: "small",
    style: "modern",
    mood: "tense",
    features: {
      walls: "off-white concrete",
      floor: "grey linoleum",
      lighting: "harsh fluorescent overhead lights",
      windows: "none",
    },
    furniture: ["steel table", "uncomfortable metal chairs", "two-way mirror"],
    details: ["coffee stains on table", "surveillance camera in corner", "clock on wall"],
    timeperiod: "modern day",
  },
  evidence: [
    {
      name: "Murder Weapon",
      type: "weapon",
      material: "steel",
      condition: "bloodstained",
      detail: "ornate letter opener with Victoria's initials",
    },
    {
      name: "Love Letter",
      type: "document",
      color: "cream",
      condition: "worn",
      detail: "handwritten note with emotional contents",
    },
  ],
  narrative: "A wealthy socialite is found dead in her garden. Two suspects emerge...",
};

// ========== HELPER: Export prompts for batch processing ==========
export const exportPromptsAsJson = (
  scenario: ScenarioDescription
): {
  suspects: Array<{ name: string; prompt: string }>;
  room: { name: string; prompt: string };
  evidence: Array<{ name: string; prompt: string }>;
} => {
  const prompts = generateCompleteScenarioPrompts(scenario);

  return {
    suspects: Object.entries(prompts.suspects).map(([name, prompt]) => ({
      name,
      prompt,
    })),
    room: {
      name: scenario.room.type,
      prompt: prompts.room,
    },
    evidence: Object.entries(prompts.evidence).map(([name, prompt]) => ({
      name,
      prompt,
    })),
  };
};

export default {
  generateSuspectPrompt,
  generateRoomPrompt,
  generateEvidencePrompt,
  generateCompleteScenarioPrompts,
  exportPromptsAsJson,
  EXAMPLE_INTERROGATION_SCENARIO,
};
