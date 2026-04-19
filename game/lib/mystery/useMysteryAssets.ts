/**
 * useMysteryAssets Hook
 *
 * Easy-to-use React hook for generating game assets from a mystery
 * Just pass your generated mystery and get back ready-to-use assets
 */

import { useEffect, useState, useCallback } from "react";
import { getMysteryService } from "./MysteryToGameAssetsService";
import type { GeneratedMystery, GameAssets } from "./MysteryToGameAssetsService";

export interface UseMysteryAssetsResult {
  assets: GameAssets | null;
  isLoading: boolean;
  error: Error | null;
  progress: string;
  generate: (mystery: GeneratedMystery) => Promise<GameAssets>;
  reset: () => void;
}

/**
 * Hook to generate game assets from mystery
 */
export function useMysteryAssets(): UseMysteryAssetsResult {
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState("Ready");

  const generate = useCallback(async (mystery: GeneratedMystery) => {
    setIsLoading(true);
    setError(null);
    setProgress("Generating...");

    try {
      const service = getMysteryService();
      setProgress("Generating Tripo models...");
      const result = await service.generateGameAssets(mystery);

      setAssets(result);
      setProgress("Complete!");
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setProgress("Error");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAssets(null);
    setError(null);
    setProgress("Ready");
  }, []);

  return {
    assets,
    isLoading,
    error,
    progress,
    generate,
    reset,
  };
}

export default useMysteryAssets;
