/**
 * useTripoModel Hook
 *
 * React hook for loading and managing Tripo models in Three.js scenes.
 * Handles loading, scaling, positioning, and error handling.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import tripoModelManager, { TripoModel } from "./TripoModelManager";

export interface UseTripoModelOptions {
  autoLoad?: boolean;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  normalizeHumanoid?: boolean;
  targetHeight?: number;
  fitToBounds?: {
    width: number;
    height?: number;
  };
  onLoad?: (scene: THREE.Group) => void;
  onError?: (error: Error) => void;
}

export interface UseTripoModelResult {
  scene: THREE.Group | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

/**
 * Load a single Tripo model by ID
 */
export function useTripoModel(
  modelId: string,
  options: UseTripoModelOptions = {}
): UseTripoModelResult {
  const {
    autoLoad = true,
    scale,
    position,
    rotation,
    normalizeHumanoid = false,
    targetHeight,
    fitToBounds,
    onLoad,
    onError,
  } = options;

  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const manager = useRef(tripoModelManager);

  const loadModel = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedScene = await manager.current.loadModel(modelId);

      if (normalizeHumanoid) {
        manager.current.normalizeHumanoid(loadedScene, targetHeight);
      }

      // Apply transformations
      if (scale !== undefined) {
        manager.current.scaleModel(loadedScene, scale);
      }

      if (position) {
        manager.current.positionModel(loadedScene, position);
      }

      if (rotation) {
        manager.current.rotateModel(loadedScene, rotation);
      }

      if (fitToBounds) {
        manager.current.fitModelToBounds(
          loadedScene,
          fitToBounds.width,
          fitToBounds.height
        );
      }

      setScene(loadedScene);
      onLoad?.(loadedScene);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) {
      loadModel();
    }
  }, [modelId]);

  return {
    scene,
    isLoading,
    error,
    reload: loadModel,
  };
}

/**
 * Load multiple Tripo models
 */
export function useTripoModels(
  modelIds: string[],
  options: Omit<UseTripoModelOptions, "scale" | "position" | "rotation"> = {}
): {
  scenes: Map<string, THREE.Group>;
  isLoading: boolean;
  errors: Map<string, Error>;
  reload: () => Promise<void>;
} {
  const { autoLoad = true, onLoad, onError } = options;

  const [scenes, setScenes] = useState<Map<string, THREE.Group>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const manager = useRef(tripoModelManager);

  const loadModels = async () => {
    setIsLoading(true);
    setErrors(new Map());

    try {
      const loaded = await manager.current.loadMultipleModels(modelIds);
      setScenes(loaded);

      loaded.forEach((scene: THREE.Group) => {
        onLoad?.(scene);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      setErrors(prev => new Map(prev).set("batch", error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad && modelIds.length > 0) {
      loadModels();
    }
  }, [modelIds.join(",")]); // Join to compare arrays properly

  return {
    scenes,
    isLoading,
    errors,
    reload: loadModels,
  };
}

/**
 * Register and manage a Tripo model
 */
export function useTripoModelRegistry() {
  const manager = useRef(tripoModelManager);

  return {
    register: (model: TripoModel) => manager.current.registerModel(model),
    getModel: (id: string) => manager.current.getModel(id),
    listModels: (type?: string) => manager.current.listModels(type as any),
    clearCache: () => manager.current.clearCache(),
  };
}

export default useTripoModel;
