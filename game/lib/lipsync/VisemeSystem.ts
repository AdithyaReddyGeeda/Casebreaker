/**
 * Viseme System for Lip Sync
 *
 * Defines facial visemes (phoneme-to-mouth-shape mappings) and provides
 * audio-to-viseme conversion for real-time lip sync animation.
 *
 * Visemes are the visual equivalents of phonemes - the distinct mouth shapes
 * made when producing different sounds.
 */

/**
 * Standard Viseme Set (14 visemes cover ~95% of speech)
 * These are the distinct mouth shapes in human speech
 */
export enum Viseme {
  SILENCE = 0,      // No mouth movement
  PP_B_M = 1,       // p, b, m - closed lips
  F_V = 2,          // f, v - lower lip to upper teeth
  TH = 3,           // th - tongue between teeth
  DD_T_N = 4,       // d, t, n - tongue at alveolar ridge
  L = 5,            // l - side of tongue
  S_Z = 6,          // s, z - sibilants
  SH_CH_J_ZH = 7,   // sh, ch, j, zh
  NG = 8,           // ng - back of tongue raised
  AA = 9,           // a, ah - open mouth
  EE = 10,          // e, i - spread lips
  OO = 11,          // o, u - rounded lips
  RR = 12,          // r - lip rounding
  AH = 13,          // uh, o - relaxed
  ER = 14,          // er, ir, ur - r-coloring
}

/**
 * Viseme definition with blend shape weights for 3D models
 * Blend shapes should be named in Tripo/Blender models:
 * - viseme_A, viseme_E, viseme_I, viseme_O, viseme_U
 * - viseme_PP, viseme_FF, viseme_TH, viseme_DD, viseme_RR, etc.
 */
export interface VisemeDefinition {
  name: string;
  phonemes: string[]; // IPA phonemes that map to this viseme
  blendShapes: Record<string, number>; // Blend shape name → weight (0-1)
  description: string;
}

/**
 * Complete Viseme Library with Blend Shape Weights
 * These weights define how much each mouth shape contributes
 */
export const VISEME_LIBRARY: Record<Viseme, VisemeDefinition> = {
  [Viseme.SILENCE]: {
    name: "Silence",
    phonemes: ["#"],
    blendShapes: {
      viseme_rest: 1.0,
      viseme_A: 0.0,
      viseme_E: 0.0,
      viseme_I: 0.0,
      viseme_O: 0.0,
      viseme_U: 0.0,
    },
    description: "Closed mouth, no movement",
  },
  [Viseme.PP_B_M]: {
    name: "PP/B/M",
    phonemes: ["p", "b", "m"],
    blendShapes: {
      viseme_PP: 1.0,
      viseme_rest: 0.0,
      viseme_A: 0.1,
    },
    description: "Bilabial - closed lips",
  },
  [Viseme.F_V]: {
    name: "F/V",
    phonemes: ["f", "v"],
    blendShapes: {
      viseme_FF: 1.0,
      viseme_E: 0.2,
    },
    description: "Lower lip to upper teeth",
  },
  [Viseme.TH]: {
    name: "TH",
    phonemes: ["θ", "ð"], // theta, eth
    blendShapes: {
      viseme_TH: 1.0,
      viseme_E: 0.3,
    },
    description: "Tongue between teeth",
  },
  [Viseme.DD_T_N]: {
    name: "DD/T/N",
    phonemes: ["d", "t", "n"],
    blendShapes: {
      viseme_DD: 1.0,
      viseme_E: 0.2,
    },
    description: "Tongue at alveolar ridge",
  },
  [Viseme.L]: {
    name: "L",
    phonemes: ["l"],
    blendShapes: {
      viseme_L: 1.0,
      viseme_E: 0.3,
    },
    description: "Side of tongue visible",
  },
  [Viseme.S_Z]: {
    name: "S/Z",
    phonemes: ["s", "z"],
    blendShapes: {
      viseme_S: 1.0,
      viseme_E: 0.4,
    },
    description: "Sibilants - teeth together",
  },
  [Viseme.SH_CH_J_ZH]: {
    name: "SH/CH/J/ZH",
    phonemes: ["ʃ", "tʃ", "dʒ", "ʒ"], // sh, ch, j, zh
    blendShapes: {
      viseme_SH: 1.0,
      viseme_O: 0.2,
    },
    description: "Post-alveolar - lips rounded slightly",
  },
  [Viseme.NG]: {
    name: "NG",
    phonemes: ["ŋ"], // ng
    blendShapes: {
      viseme_O: 0.5,
      viseme_U: 0.3,
    },
    description: "Back of tongue raised",
  },
  [Viseme.AA]: {
    name: "AA",
    phonemes: ["ɑ", "a"],
    blendShapes: {
      viseme_A: 1.0,
    },
    description: "Wide open mouth",
  },
  [Viseme.EE]: {
    name: "EE",
    phonemes: ["i", "e"],
    blendShapes: {
      viseme_E: 1.0,
      viseme_I: 0.5,
    },
    description: "Spread lips, teeth visible",
  },
  [Viseme.OO]: {
    name: "OO",
    phonemes: ["u", "o"],
    blendShapes: {
      viseme_O: 1.0,
      viseme_U: 0.7,
    },
    description: "Rounded lips, narrow opening",
  },
  [Viseme.RR]: {
    name: "RR",
    phonemes: ["ɹ", "r"],
    blendShapes: {
      viseme_RR: 1.0,
      viseme_U: 0.3,
    },
    description: "R-coloring, lips rounded",
  },
  [Viseme.AH]: {
    name: "AH",
    phonemes: ["ʌ", "ə"],
    blendShapes: {
      viseme_A: 0.5,
      viseme_O: 0.3,
    },
    description: "Relaxed mouth, neutral",
  },
  [Viseme.ER]: {
    name: "ER",
    phonemes: ["ɝ", "ə˞"],
    blendShapes: {
      viseme_ER: 1.0,
      viseme_RR: 0.4,
    },
    description: "R-colored vowel",
  },
};

/**
 * Phoneme to Viseme Mapping
 * Maps IPA phonemes to their corresponding visemes
 */
export const PHONEME_TO_VISEME: Record<string, Viseme> = {};

// Build phoneme → viseme mapping from library
Object.entries(VISEME_LIBRARY).forEach(([visemeId, def]) => {
  def.phonemes.forEach((phoneme) => {
    PHONEME_TO_VISEME[phoneme.toLowerCase()] = parseInt(visemeId);
  });
});

/**
 * Get viseme from phoneme string
 */
export function getVisemeFromPhoneme(phoneme: string): Viseme {
  const normalized = phoneme.toLowerCase().trim();
  return PHONEME_TO_VISEME[normalized] ?? Viseme.SILENCE;
}

/**
 * Get viseme definition
 */
export function getVisemeDefinition(viseme: Viseme): VisemeDefinition {
  return VISEME_LIBRARY[viseme] || VISEME_LIBRARY[Viseme.SILENCE];
}

/**
 * Blend shape weight application
 * Returns blend shape values for a specific viseme
 */
export function getVisemeBlendShapes(viseme: Viseme): Record<string, number> {
  return getVisemeDefinition(viseme).blendShapes;
}

/**
 * Smooth transition between visemes
 * Interpolates blend shapes over time for smoother animation
 */
export function interpolateVisemes(
  fromViseme: Viseme,
  toViseme: Viseme,
  t: number // 0 to 1
): Record<string, number> {
  const fromShapes = getVisemeBlendShapes(fromViseme);
  const toShapes = getVisemeBlendShapes(toViseme);

  // Get all unique blend shape names
  const allShapes = new Set([
    ...Object.keys(fromShapes),
    ...Object.keys(toShapes),
  ]);

  const result: Record<string, number> = {};

  allShapes.forEach((shape) => {
    const fromValue = fromShapes[shape] ?? 0;
    const toValue = toShapes[shape] ?? 0;
    result[shape] = fromValue + (toValue - fromValue) * t;
  });

  return result;
}

/**
 * Sequence of visemes with timing
 */
export interface VisemeFrame {
  viseme: Viseme;
  startTime: number; // Seconds
  endTime: number; // Seconds
  confidence?: number; // 0-1 confidence score
}

/**
 * Advanced: Viseme curve for smooth animation
 * Creates easing curves between viseme transitions
 */
export function createVisemeCurve(
  frames: VisemeFrame[],
  smoothing: "none" | "linear" | "ease-in-out" = "ease-in-out"
): (time: number) => Record<string, number> {
  return (currentTime: number) => {
    // Find current viseme frame
    let fromFrame = frames[0];
    let toFrame = frames[frames.length - 1];

    for (let i = 0; i < frames.length - 1; i++) {
      if (currentTime >= frames[i].startTime && currentTime <= frames[i + 1].endTime) {
        fromFrame = frames[i];
        toFrame = frames[i + 1];
        break;
      }
    }

    // Calculate transition progress
    const frameDuration = toFrame.startTime - fromFrame.startTime;
    const elapsed = currentTime - fromFrame.startTime;
    let t = Math.max(0, Math.min(1, elapsed / frameDuration));

    // Apply easing
    if (smoothing === "ease-in-out") {
      t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Cubic ease-in-out
    }

    return interpolateVisemes(fromFrame.viseme, toFrame.viseme, t);
  };
}

export default {
  Viseme,
  VISEME_LIBRARY,
  PHONEME_TO_VISEME,
  getVisemeFromPhoneme,
  getVisemeDefinition,
  getVisemeBlendShapes,
  interpolateVisemes,
  createVisemeCurve,
};
