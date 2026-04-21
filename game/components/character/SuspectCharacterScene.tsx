"use client";

import { useEffect, useMemo, useState } from "react";
import type { SuspectId } from "@/lib/cases/harlow-manor";
import CharacterCanvas, { LoadingFallback } from "./CharacterCanvas";
import { ErrorBoundary } from "./ErrorBoundary";
import { buildCharacterPromptForSuspect } from "@/lib/character/character";
import { getCharacterDefinition } from "@/lib/character/character-catalog";
import type {
  CharacterTimestampRange,
  ResolvedCharacterModel,
  VisemeTimeline,
} from "@/lib/character/character-pipeline";

interface SuspectCharacterSceneProps {
  suspectId: SuspectId;
  speaking: boolean;
  stressed: boolean;
  characterTimestamps?: CharacterTimestampRange[] | null;
  visemeTimeline?: VisemeTimeline | null;
  speechElapsedMs?: number;
  presentation?: "standing" | "seated";
}

const resolvedCharacterCache = new Map<string, ResolvedCharacterModel>();

export default function SuspectCharacterScene({
  suspectId,
  speaking,
  stressed,
  characterTimestamps,
  visemeTimeline,
  speechElapsedMs = 0,
  presentation = "standing",
}: SuspectCharacterSceneProps) {
  const definition = useMemo(() => getCharacterDefinition(suspectId), [suspectId]);
  const cacheKey = `${suspectId}:${definition.generatedModelPath}`;
  const [isResolvingModel, setIsResolvingModel] = useState(!resolvedCharacterCache.has(cacheKey));
  const [resolvedModel, setResolvedModel] = useState<ResolvedCharacterModel>(() => {
    const cached = resolvedCharacterCache.get(cacheKey);
    return (
      cached ?? {
        suspectId,
        modelPath: "",
        source: "fallback",
        motionMode: "rigid",
        rigReport: null,
      }
    );
  });

  useEffect(() => {
    if (!isResolvingModel) return;

    let cancelled = false;

    const promoteGeneratedModelIfReady = async () => {
      try {
        const cacheBust = Date.now();
        const response = await fetch(`${definition.generatedModelPath}?v=${cacheBust}`, {
          method: "HEAD",
          cache: "no-store",
        });

        if (!response.ok || cancelled) return;

        const nextModel: ResolvedCharacterModel = {
          suspectId,
          modelPath: `${definition.generatedModelPath}?v=${cacheBust}`,
          source: "local-cache",
          motionMode: "rigid",
          rigReport: null,
        };

        console.log("[character-scene] promoted generated model from local cache", {
          suspectId,
          modelPath: nextModel.modelPath,
        });

        resolvedCharacterCache.set(cacheKey, nextModel);
        setResolvedModel(nextModel);
        setIsResolvingModel(false);
      } catch {
        // Keep polling while generation is still in flight.
      }
    };

    void promoteGeneratedModelIfReady();
    const intervalId = window.setInterval(() => {
      void promoteGeneratedModelIfReady();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [cacheKey, definition.generatedModelPath, isResolvingModel, suspectId]);

  useEffect(() => {
    const cached = resolvedCharacterCache.get(cacheKey);
    if (cached) {
      setIsResolvingModel(false);
      setResolvedModel(cached);
      return;
    }

    setIsResolvingModel(true);
    setResolvedModel({
      suspectId,
      modelPath: "",
      source: "fallback",
      motionMode: "rigid",
      rigReport: null,
    });

    const controller = new AbortController();

    void fetch("/api/tripo/generate-model", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        suspectId,
        prompt: buildCharacterPromptForSuspect(suspectId),
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as Partial<ResolvedCharacterModel> & {
          modelPath?: string;
          modelUrl?: string;
        };
        if (controller.signal.aborted) return;

        const nextModel: ResolvedCharacterModel = {
          suspectId,
          modelPath: (data.modelPath ?? data.modelUrl ?? "").trim(),
          source: data.source === "tripo" || data.source === "local-cache" ? data.source : "fallback",
          motionMode: data.motionMode ?? "rigid",
          rigReport: data.rigReport ?? null,
          prompt: data.prompt,
          generatedAtIso: data.generatedAtIso,
          taskId: data.taskId,
        };

        console.log("[character-scene] resolved model", {
          suspectId,
          source: nextModel.source,
          modelPath: nextModel.modelPath,
          motionMode: nextModel.motionMode,
        });

        resolvedCharacterCache.set(cacheKey, nextModel);
        setIsResolvingModel(false);
        setResolvedModel(nextModel);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("[character] falling back to local model", { suspectId, error });
        setIsResolvingModel(false);
      });

    return () => {
      controller.abort();
    };
  }, [cacheKey, definition.generatedModelPath, suspectId]);

  if (isResolvingModel) {
    return <LoadingFallback />;
  }

  return (
    <ErrorBoundary onError={() => setResolvedModel((current) => ({ ...current, modelPath: "" }))}>
      <CharacterCanvas
        modelPath={resolvedModel.modelPath}
        speaking={speaking}
        stressed={stressed}
        characterTimestamps={characterTimestamps}
        visemeTimeline={visemeTimeline}
        speechElapsedMs={speechElapsedMs}
        preferredYaw={definition.preferredYaw}
        presentation={presentation}
      />
    </ErrorBoundary>
  );
}
