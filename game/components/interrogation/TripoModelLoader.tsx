/**
 * Tripo Model Loader Component
 *
 * React Three Fiber component for loading and rendering Tripo-generated 3D models.
 * Use this to add dynamically generated suspects, rooms, and evidence to your scenes.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useTripoModel } from "@/lib/tripo/useTripoModel";
import { TripoModelManager, type TripoModel } from "@/lib/tripo/TripoModelManager";

export interface TripoModelLoaderProps {
  /** Unique identifier for this model */
  modelId: string;

  /** Type of model: suspect, room, evidence, etc */
  modelType: "suspect" | "room" | "evidence" | "furniture";

  /** Scale multiplier (default: 1) */
  scale?: number;

  /** Position in scene */
  position?: [number, number, number];

  /** Rotation in radians */
  rotation?: [number, number, number];

  /** Auto-fit to bounds */
  fitToBounds?: { width: number; height?: number };

  /** Callback when model loads */
  onLoad?: (group: THREE.Group) => void;

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Show loading indicator */
  showLoader?: boolean;
}

/**
 * Single Model Loader Component
 */
export function TripoModelLoader({
  modelId,
  modelType,
  scale,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  fitToBounds,
  onLoad,
  onError,
  showLoader = true,
}: TripoModelLoaderProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  const { scene: loadedScene, isLoading, error } = useTripoModel(modelId, {
    scale,
    fitToBounds,
    onLoad,
    onError,
  });

  useEffect(() => {
    if (loadedScene && groupRef.current) {
      // Clear previous children
      groupRef.current.clear();

      // Add loaded scene to group
      groupRef.current.add(loadedScene);

      // Apply transformations
      groupRef.current.position.set(position[0], position[1], position[2]);
      groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);

      console.log(`✨ Model loaded: ${modelId}`);
    }
  }, [loadedScene, position, rotation]);

  if (error) {
    console.error(`❌ Failed to load model ${modelId}:`, error.message);
  }

  return (
    <>
      <group ref={groupRef} />
      {isLoading && showLoader && (
        <LoadingIndicator position={position} />
      )}
    </>
  );
}

/**
 * Multi-Model Loader Component
 * Load multiple models at once (suspects, room, evidence)
 */
export interface TripoSceneSetupProps {
  /** Configuration for suspect models */
  suspects?: Array<{
    id: string;
    scale?: number;
    position?: [number, number, number];
  }>;

  /** Configuration for room model */
  room?: {
    id: string;
    scale?: number;
    position?: [number, number, number];
  };

  /** Configuration for evidence models */
  evidence?: Array<{
    id: string;
    scale?: number;
    position?: [number, number, number];
  }>;

  onAllLoaded?: () => void;
  onError?: (error: Error) => void;
}

export function TripoSceneSetup({
  suspects = [],
  room,
  evidence = [],
  onAllLoaded,
  onError,
}: TripoSceneSetupProps) {
  const loadedCount = useRef(0);
  const totalModels = suspects.length + (room ? 1 : 0) + evidence.length;

  const handleModelLoad = () => {
    loadedCount.current++;
    if (loadedCount.current === totalModels) {
      onAllLoaded?.();
    }
  };

  return (
    <>
      {/* Load room first (background) */}
      {room && (
        <TripoModelLoader
          modelId={room.id}
          modelType="room"
          scale={room.scale}
          position={room.position}
          onLoad={() => handleModelLoad()}
          onError={onError}
        />
      )}

      {/* Load suspects */}
      {suspects.map((suspect, idx) => (
        <TripoModelLoader
          key={`suspect-${idx}`}
          modelId={suspect.id}
          modelType="suspect"
          scale={suspect.scale}
          position={suspect.position}
          onLoad={() => handleModelLoad()}
          onError={onError}
        />
      ))}

      {/* Load evidence */}
      {evidence.map((item, idx) => (
        <TripoModelLoader
          key={`evidence-${idx}`}
          modelId={item.id}
          modelType="evidence"
          scale={item.scale}
          position={item.position}
          onLoad={() => handleModelLoad()}
          onError={onError}
        />
      ))}
    </>
  );
}

/**
 * Loading Indicator Component
 */
function LoadingIndicator({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#ffd700"
          wireframe
          emissive="#ffd700"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

/**
 * Helper: Register models from descriptions
 */
export async function registerTripoModels(
  models: Array<{
    id: string;
    name: string;
    type: "suspect" | "room" | "evidence" | "furniture";
    url: string;
  }>
) {
  const manager = TripoModelManager.getInstance();

  models.forEach((model) => {
    manager.registerModel({
      id: model.id,
      name: model.name,
      type: model.type,
      url: model.url,
      loaded: false,
    });
  });

  console.log(`✅ Registered ${models.length} Tripo models`);
}

export default TripoModelLoader;
