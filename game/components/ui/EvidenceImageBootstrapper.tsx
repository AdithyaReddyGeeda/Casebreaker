"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";
import {
  readEvidenceImageCache,
  requestEvidenceImageGeneration,
  writeEvidenceImageCache,
} from "@/lib/evidence/images";

export default function EvidenceImageBootstrapper() {
  const { screen, caseId, evidence, updateEvidenceImage } = useGameStore();
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (screen === "intro") return;

    for (const item of evidence) {
      const prompt = item.imagePrompt?.trim();
      if (!prompt) continue;

      const cacheKey = `${caseId}:${item.id}`;
      const cached = readEvidenceImageCache(caseId, item.id);

      if (cached?.imageUrl) {
        if (item.imageUrl !== cached.imageUrl || item.imageStatus !== "ready") {
          updateEvidenceImage(item.id, {
            imageUrl: cached.imageUrl,
            imagePrompt: prompt,
            imageStatus: "ready",
          });
        }
        continue;
      }

      if (
        item.imageStatus === "ready" ||
        item.imageStatus === "generating" ||
        item.imageStatus === "failed"
      ) {
        continue;
      }
      if (inFlightRef.current.has(cacheKey)) continue;

      inFlightRef.current.add(cacheKey);
      console.log("[evidence-images] generating", { caseId, evidenceId: item.id });

      updateEvidenceImage(item.id, {
        imageUrl: item.imageUrl,
        imagePrompt: prompt,
        imageStatus: "generating",
      });

      void requestEvidenceImageGeneration({
        caseId,
        evidenceId: item.id,
        prompt,
      })
        .then(({ imageUrl, cached: fromServerCache }) => {
          console.log("[evidence-images] ready", {
            caseId,
            evidenceId: item.id,
            fromServerCache,
          });

          writeEvidenceImageCache({
            caseId,
            evidenceId: item.id,
            imageUrl,
            prompt,
            cachedAt: Date.now(),
          });

          updateEvidenceImage(item.id, {
            imageUrl,
            imagePrompt: prompt,
            imageStatus: "ready",
          });
        })
        .catch((error) => {
          console.warn("[evidence-images] failed", { caseId, evidenceId: item.id, error });
          updateEvidenceImage(item.id, {
            imageUrl: undefined,
            imagePrompt: prompt,
            imageStatus: "failed",
          });
        })
        .finally(() => {
          inFlightRef.current.delete(cacheKey);
        });
    }
  }, [caseId, evidence, screen, updateEvidenceImage]);

  return null;
}
