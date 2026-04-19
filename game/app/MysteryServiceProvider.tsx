"use client";

import { useEffect } from "react";
import { initializeMysteryService } from "@/lib/mystery/MysteryToGameAssetsService";

export function MysteryServiceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize mystery service with API keys from environment
    const tripoKey = process.env.NEXT_PUBLIC_TRIPO_API_KEY;
    const elevenLabsKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const elevenLabsVoiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "bella";
    const deepgramKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

    if (tripoKey && elevenLabsKey && deepgramKey) {
      console.log("🎬 Initializing Mystery Service with API keys...");
      initializeMysteryService({
        tripoApiKey: tripoKey,
        elevenLabsApiKey: elevenLabsKey,
        elevenLabsVoiceId: elevenLabsVoiceId,
        deepgramApiKey: deepgramKey,
      });
      console.log("✅ Mystery Service initialized");
    } else {
      console.error("❌ Missing required API keys in .env.local:");
      if (!tripoKey) console.error("  - NEXT_PUBLIC_TRIPO_API_KEY");
      if (!elevenLabsKey) console.error("  - NEXT_PUBLIC_ELEVENLABS_API_KEY");
      if (!deepgramKey) console.error("  - NEXT_PUBLIC_DEEPGRAM_API_KEY");
    }
  }, []);

  return <>{children}</>;
}
