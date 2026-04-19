/**
 * Mystery to Game Assets Service
 *
 * Fully automated workflow: Takes a generated mystery and outputs ready-to-play game assets
 * - Generates Tripo 3D models from suspect descriptions
 * - Generates ElevenLabs dialogue for each suspect
 * - Analyzes audio for lip sync with Deepgram
 * - Registers everything and returns game state
 *
 * ONE SERVICE TO RULE THEM ALL 🎬
 */

import { generateSuspectPrompt, generateRoomPrompt, generateEvidencePrompt } from "@/lib/tripo/TripoPromptTemplates";
import { registerTripoModels } from "@/components/interrogation/TripoModelLoader";
import { AudioAnalyzerManager } from "@/lib/lipsync/AudioAnalyzer";
import type { SuspectDescription, RoomDescription, EvidenceDescription } from "@/lib/tripo/TripoPromptTemplates";
import type { VisemeFrame } from "@/lib/lipsync/VisemeSystem";

/**
 * Generated Mystery Structure
 * This is what your game generates
 */
export interface GeneratedMystery {
  caseId: string;
  title: string;
  description: string;
  suspects: SuspectDescription[];
  room: RoomDescription;
  evidence: EvidenceDescription[];
  metadata?: {
    difficulty?: "easy" | "medium" | "hard";
    timeLimit?: number; // seconds
    hiddenClues?: string[];
  };
}

/**
 * Game Assets Output
 * Ready to use in your React Three Fiber scene
 */
export interface GameAssets {
  caseId: string;
  title: string;
  suspects: Array<{
    id: string;
    modelId: string;
    audioUrl: string;
    visemeFrames: VisemeFrame[];
    originalData: SuspectDescription;
  }>;
  room: {
    id: string;
    originalData: RoomDescription;
  };
  evidence: Array<{
    id: string;
    originalData: EvidenceDescription;
  }>;
  generatedAt: number;
  ready: boolean;
}

/**
 * Main Service Class
 */
export class MysteryToGameAssetsService {
  private tripoApiKey: string;
  private elevenLabsApiKey: string;
  private elevenLabsVoiceId: string;
  private deepgramApiKey: string;
  private audioAnalyzer: AudioAnalyzerManager | null = null;

  constructor(config: {
    tripoApiKey: string;
    elevenLabsApiKey: string;
    elevenLabsVoiceId: string;
    deepgramApiKey: string;
  }) {
    this.tripoApiKey = config.tripoApiKey;
    this.elevenLabsApiKey = config.elevenLabsApiKey;
    this.elevenLabsVoiceId = config.elevenLabsVoiceId;
    this.deepgramApiKey = config.deepgramApiKey;

    // Initialize audio analyzer
    try {
      this.audioAnalyzer = new AudioAnalyzerManager("deepgram", config.deepgramApiKey);
    } catch (error) {
      console.error("Failed to initialize audio analyzer:", error);
    }
  }

  /**
   * MAIN ENTRY POINT: Convert mystery to game assets
   */
  async generateGameAssets(mystery: GeneratedMystery): Promise<GameAssets> {
    console.log(`🎬 Generating assets for: ${mystery.title}`);
    console.log(`   Case ID: ${mystery.caseId}`);
    console.log(`   Suspects: ${mystery.suspects.length}`);

    const startTime = Date.now();

    try {
      // Step 1: Generate Tripo models
      console.log("📦 Generating Tripo models...");
      const tripoModels = await this.generateTripoModels(mystery);

      // Step 2: Generate dialogue audio
      console.log("🎙️ Generating dialogue with ElevenLabs...");
      const dialogueAudio = await this.generateSuspectDialogue(mystery);

      // Step 3: Analyze audio for lip sync
      console.log("👄 Analyzing for lip sync...");
      const visemeData = await this.analyzeLipSync(dialogueAudio);

      // Step 4: Register all models
      console.log("📝 Registering models...");
      await this.registerAllAssets(tripoModels);

      // Step 5: Assemble game state
      const gameAssets = this.assembleGameAssets(mystery, tripoModels, dialogueAudio, visemeData);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ COMPLETE! Generated in ${duration}s`);
      console.log(`   Ready to interrogate ${mystery.suspects.length} suspects 🕵️`);

      return gameAssets;
    } catch (error) {
      console.error("❌ Failed to generate game assets:", error);
      throw error;
    }
  }

  /**
   * Step 1: Generate Tripo 3D Models
   */
  private async generateTripoModels(
    mystery: GeneratedMystery
  ): Promise<
    Array<{
      id: string;
      name: string;
      url: string;
    }>
  > {
    const models = [];

    // Generate suspect models
    for (const suspect of mystery.suspects) {
      try {
        const prompt = generateSuspectPrompt(suspect);
        console.log(`   Generating: ${suspect.name}...`);

        const modelUrl = await this.callTripoAPI(prompt);
        const modelId = `suspect-${suspect.name.toLowerCase().replace(/\s+/g, "-")}`;

        models.push({
          id: modelId,
          name: suspect.name,
          url: modelUrl,
        });
      } catch (error) {
        console.warn(`   ⚠️ Failed to generate model for ${suspect.name}, using placeholder:`, error);
        // Use placeholder model when Tripo fails
        const modelId = `suspect-${suspect.name.toLowerCase().replace(/\s+/g, "-")}`;
        models.push({
          id: modelId,
          name: suspect.name,
          url: "placeholder://suspect-model", // Placeholder URL
        });
      }
    }

    // Generate room model
    try {
      const roomPrompt = generateRoomPrompt(mystery.room);
      console.log(`   Generating: Room...`);

      const roomUrl = await this.callTripoAPI(roomPrompt);
      models.push({
        id: `room-${mystery.caseId}`,
        name: "Interrogation Room",
        url: roomUrl,
      });
    } catch (error) {
      console.warn("   ⚠️ Failed to generate room model, using placeholder:", error);
      // Use placeholder model when Tripo fails
      models.push({
        id: `room-${mystery.caseId}`,
        name: "Interrogation Room",
        url: "placeholder://room-model", // Placeholder URL
      });
    }

    return models;
  }

  /**
   * Call Tripo API via server-side endpoint to avoid CORS issues
   */
  private async callTripoAPI(prompt: string): Promise<string> {
    try {
      const response = await fetch("/api/tripo/generate-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Tripo API error: ${error.error}`);
      }

      const result = await response.json();
      return result.modelUrl;
    } catch (error) {
      console.error("Tripo API call failed:", error);
      throw error;
    }
  }

  /**
   * Step 2: Generate Suspect Dialogue with ElevenLabs
   */
  private async generateSuspectDialogue(
    mystery: GeneratedMystery
  ): Promise<Record<string, Blob>> {
    const dialogues: Record<string, Blob> = {};

    for (const suspect of mystery.suspects) {
      try {
        // Create naturalistic dialogue from case details
        const script = this.createSuspectScript(suspect, mystery);
        console.log(`   Generating voice: ${suspect.name}...`);

        const audioBlob = await this.callElevenLabsAPI(script);
        const suspectId = suspect.name.toLowerCase().replace(/\s+/g, "-");
        dialogues[suspectId] = audioBlob;
      } catch (error) {
        console.warn(`   ⚠️ Failed to generate dialogue for ${suspect.name}:`, error);
      }
    }

    return dialogues;
  }

  /**
   * Create realistic suspect dialogue
   */
  private createSuspectScript(suspect: SuspectDescription, mystery: GeneratedMystery): string {
    return `
My name is ${suspect.name}. I'm ${suspect.age} years old.

I know what you're thinking, but I had nothing to do with this.
${suspect.appearance.expression || "I'm telling you the truth."}

${suspect.appearance.distinctive ? `You can ask anyone about my ${suspect.appearance.distinctive}.` : ""}

I didn't kill anyone. This is a terrible mistake.
    `.trim();
  }

  /**
   * Call ElevenLabs API via server-side endpoint to avoid CORS issues
   */
  private async callElevenLabsAPI(text: string): Promise<Blob> {
    try {
      const response = await fetch("/api/elevenlabs/generate-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: this.elevenLabsVoiceId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`ElevenLabs API error: ${error.error}`);
      }

      return await response.blob();
    } catch (error) {
      console.error("ElevenLabs API call failed:", error);
      throw error;
    }
  }

  /**
   * Step 3: Analyze audio for lip sync
   */
  private async analyzeLipSync(
    audioBlobs: Record<string, Blob>
  ): Promise<Record<string, VisemeFrame[]>> {
    const visemeData: Record<string, VisemeFrame[]> = {};

    if (!this.audioAnalyzer) {
      console.warn("Audio analyzer not initialized, skipping lip sync analysis");
      return visemeData;
    }

    for (const [suspectId, audioBlob] of Object.entries(audioBlobs)) {
      try {
        console.log(`   Analyzing: ${suspectId}...`);

        const analysis = await this.audioAnalyzer.analyze(audioBlob);
        visemeData[suspectId] = analysis.visemeFrames;
      } catch (error) {
        console.warn(`   ⚠️ Failed to analyze audio for ${suspectId}:`, error);
        visemeData[suspectId] = [];
      }
    }

    return visemeData;
  }

  /**
   * Step 4: Register all models
   */
  private async registerAllAssets(
    models: Array<{
      id: string;
      name: string;
      url: string;
    }>
  ): Promise<void> {
    try {
      await registerTripoModels(
        models.map((model) => ({
          id: model.id,
          name: model.name,
          type: model.id.startsWith("room") ? "room" : "suspect",
          url: model.url,
        }))
      );
    } catch (error) {
      console.warn("Failed to register models:", error);
    }
  }

  /**
   * Step 5: Assemble final game state
   */
  private assembleGameAssets(
    mystery: GeneratedMystery,
    tripoModels: Array<{ id: string; name: string; url: string }>,
    dialogueAudio: Record<string, Blob>,
    visemeData: Record<string, VisemeFrame[]>
  ): GameAssets {
    const suspects = mystery.suspects.map((suspect) => {
      const suspectId = suspect.name.toLowerCase().replace(/\s+/g, "-");
      const modelId = `suspect-${suspectId}`;
      const audioBlob = dialogueAudio[suspectId];

      return {
        id: suspectId,
        modelId: modelId,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : "",
        visemeFrames: visemeData[suspectId] || [],
        originalData: suspect,
      };
    });

    return {
      caseId: mystery.caseId,
      title: mystery.title,
      suspects,
      room: {
        id: `room-${mystery.caseId}`,
        originalData: mystery.room,
      },
      evidence: mystery.evidence.map((item) => ({
        id: item.name.toLowerCase().replace(/\s+/g, "-"),
        originalData: item,
      })),
      generatedAt: Date.now(),
      ready: true,
    };
  }
}

/**
 * Singleton instance
 */
let serviceInstance: MysteryToGameAssetsService | null = null;

export function initializeMysteryService(config: {
  tripoApiKey: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  deepgramApiKey: string;
}): MysteryToGameAssetsService {
  serviceInstance = new MysteryToGameAssetsService(config);
  console.log("✅ Mystery to Assets Service initialized");
  return serviceInstance;
}

export function getMysteryService(): MysteryToGameAssetsService {
  if (!serviceInstance) {
    throw new Error(
      "Mystery Service not initialized. Call initializeMysteryService() first."
    );
  }
  return serviceInstance;
}

export default MysteryToGameAssetsService;
