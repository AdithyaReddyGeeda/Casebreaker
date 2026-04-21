/**
 * Auto Interrogation Scene Component
 *
 * Complete example of automated workflow:
 * Generated Mystery -> Assets -> Scene Ready
 *
 * Usage:
 * <AutoInterrogationScene mystery={yourGeneratedMystery} />
 */

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import TripoModelLoader from "./TripoModelLoader";
import LipSyncController from "./LipSyncController";
import { ProfessionalControls } from "./ProfessionalControls";
import { useMysteryAssets } from "@/lib/mystery/useMysteryAssets";
import type { GeneratedMystery } from "@/lib/mystery/MysteryToGameAssetsService";

const FRONT_FACING_YAW = -Math.PI / 2;

interface AutoInterrogationSceneProps {
  mystery: GeneratedMystery;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

interface GeneratedInterrogationStageProps {
  modelId: string;
  audioUrl?: string;
}

function GeneratedInterrogationStage({
  modelId,
  audioUrl,
}: GeneratedInterrogationStageProps) {
  const controlsRef = useRef<any>(null);
  const suspectGroupRef = useRef<THREE.Group>(null);
  const orbitTarget = useMemo<[number, number, number]>(() => [0, 1.18, -0.04], []);
  const defaultCameraPosition = useMemo<[number, number, number]>(
    () => [0.02, 1.18, 2.34],
    []
  );

  return (
    <Canvas
      camera={{ position: defaultCameraPosition, fov: 33, near: 0.1, far: 100 }}
      style={{ width: "100%", height: "100%" }}
      shadows
    >
      <color attach="background" args={["#000000"]} />
      <ProfessionalControls
        controlsRef={controlsRef}
        focusTarget={orbitTarget}
        defaultCameraPosition={defaultCameraPosition}
      />

      <Suspense fallback={null}>
        <ambientLight intensity={0.08} color="#9fb0c8" />
        <directionalLight
          castShadow
          position={[0.55, 1.95, 1.35]}
          intensity={1.55}
          color="#f2ece2"
        />
        <pointLight position={[0, 1.38, 1.02]} intensity={1.1} color="#f5efe4" />
        <spotLight
          position={[0.08, 1.98, 1.5]}
          angle={0.28}
          penumbra={0.95}
          intensity={2.15}
          color="#fff7ec"
          distance={5}
          decay={1.45}
          castShadow
        />

        <mesh position={[0, 1.8, -2.2]}>
          <planeGeometry args={[10, 4.8]} />
          <meshStandardMaterial color="#090d12" roughness={0.98} metalness={0.01} />
        </mesh>

        <mesh position={[-2.8, 1.7, -1.4]} rotation={[0, Math.PI / 2.8, 0]}>
          <planeGeometry args={[3.8, 3.4]} />
          <meshStandardMaterial color="#080c10" roughness={0.98} metalness={0.01} />
        </mesh>

        <mesh position={[2.8, 1.7, -1.4]} rotation={[0, -Math.PI / 2.8, 0]}>
          <planeGeometry args={[3.8, 3.4]} />
          <meshStandardMaterial color="#080c10" roughness={0.98} metalness={0.01} />
        </mesh>

        <group ref={suspectGroupRef} position={[0, 0.42, -0.04]}>
          <TripoModelLoader
            modelId={modelId}
            modelType="suspect"
            normalizeHumanoid
            targetHeight={1.72}
            rotation={[0, FRONT_FACING_YAW, 0]}
            showLoader
          />
        </group>

        {audioUrl && suspectGroupRef.current ? (
          <LipSyncController
            suspectModel={suspectGroupRef.current}
            audioUrl={audioUrl}
            analyzerMode="deepgram"
            autoPlay
            debug={false}
          />
        ) : null}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan
          enableZoom
          enableRotate
          screenSpacePanning
          target={orbitTarget}
          minDistance={0.95}
          maxDistance={3}
          minPolarAngle={0.45}
          maxPolarAngle={Math.PI / 2 + 0.28}
          minAzimuthAngle={-Math.PI}
          maxAzimuthAngle={Math.PI}
          dampingFactor={0.09}
          enableDamping
          rotateSpeed={0.72}
          zoomSpeed={0.55}
          panSpeed={0.45}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />
      </Suspense>
    </Canvas>
  );
}

export function AutoInterrogationScene({
  mystery,
  onReady,
  onError,
}: AutoInterrogationSceneProps) {
  const { assets, isLoading, error, progress, generate } = useMysteryAssets();
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);

  useEffect(() => {
    generate(mystery)
      .then(() => {
        onReady?.();
      })
      .catch((err) => {
        onError?.(err);
      });
  }, [mystery, generate, onReady, onError]);

  useEffect(() => {
    if (!assets?.suspects.length) return;
    if (selectedSuspect) return;
    setSelectedSuspect(assets.suspects[0].id);
  }, [assets, selectedSuspect]);

  const activeSuspect =
    assets?.suspects.find((suspect) => suspect.id === selectedSuspect) ?? assets?.suspects[0] ?? null;

  if (error) {
    return (
      <div style={styles.error}>
        <h2>Error Generating Assets</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (isLoading || !assets || !activeSuspect) {
    return (
      <div style={styles.loading}>
        <h2>{mystery.title}</h2>
        <p>{progress}</p>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <GeneratedInterrogationStage
        modelId={activeSuspect.modelId}
        audioUrl={activeSuspect.audioUrl}
      />

      <div style={styles.ui}>
        <h3 style={styles.title}>{assets.title}</h3>
        <div style={styles.suspectList}>
          {assets.suspects.map((suspect) => (
            <button
              key={suspect.id}
              onClick={() => setSelectedSuspect(suspect.id)}
              style={{
                ...styles.suspectButton,
                backgroundColor:
                  activeSuspect.id === suspect.id ? "#ffd700" : "#333",
                color: activeSuspect.id === suspect.id ? "#000" : "#fff",
              }}
            >
              {suspect.originalData.name}
            </button>
          ))}
        </div>
        <p style={styles.status}>
          Interrogating {activeSuspect.originalData.name}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    position: "relative" as const,
    backgroundColor: "#000",
  },
  loading: {
    display: "flex" as const,
    flexDirection: "column" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    width: "100vw",
    height: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    fontFamily: "monospace",
  },
  spinner: {
    width: "50px",
    height: "50px",
    border: "3px solid #ffd700",
    borderTop: "3px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginTop: "20px",
  },
  error: {
    display: "flex" as const,
    flexDirection: "column" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    width: "100vw",
    height: "100vh",
    backgroundColor: "#1a0a0a",
    color: "#ff6b6b",
    fontFamily: "monospace",
    padding: "20px",
  },
  ui: {
    position: "fixed" as const,
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    color: "#fff",
    padding: "20px",
    borderRadius: "8px",
    fontFamily: "monospace",
    maxWidth: "400px",
    zIndex: 1000,
  },
  title: {
    margin: "0 0 15px 0",
    fontSize: "18px",
    fontWeight: "bold" as const,
    color: "#ffd700",
  },
  suspectList: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "10px",
    marginBottom: "15px",
  },
  suspectButton: {
    padding: "10px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer" as const,
    fontFamily: "monospace",
    fontWeight: "bold" as const,
    transition: "all 0.2s",
  },
  status: {
    margin: 0,
    fontSize: "12px",
    color: "#aaa",
    textAlign: "center" as const,
  },
};

export default AutoInterrogationScene;
