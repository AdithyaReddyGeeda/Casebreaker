/**
 * Auto Interrogation Scene Component
 *
 * Complete example of automated workflow:
 * Generated Mystery → Assets → Scene Ready
 *
 * Usage:
 * <AutoInterrogationScene mystery={yourGeneratedMystery} />
 */

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import TripoModelLoader, { TripoSceneSetup } from "./TripoModelLoader";
import LipSyncController from "./LipSyncController";
import { ProfessionalControls } from "./ProfessionalControls";
import { useMysteryAssets } from "@/lib/mystery/useMysteryAssets";
import type { GeneratedMystery } from "@/lib/mystery/MysteryToGameAssetsService";

interface AutoInterrogationSceneProps {
  mystery: GeneratedMystery;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function AutoInterrogationScene({
  mystery,
  onReady,
  onError,
}: AutoInterrogationSceneProps) {
  const { assets, isLoading, error, progress, generate } = useMysteryAssets();
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const roomRef = useRef<THREE.Group>(null);
  const suspectRef = useRef<THREE.Group>(null);

  // Generate assets on mount
  useEffect(() => {
    generate(mystery).then(() => {
      onReady?.();
    }).catch((err) => {
      onError?.(err);
    });
  }, [mystery, generate, onReady, onError]);

  if (error) {
    return (
      <div style={styles.error}>
        <h2>❌ Error Generating Assets</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (isLoading || !assets) {
    return (
      <div style={styles.loading}>
        <h2>🎬 {mystery.title}</h2>
        <p>{progress}</p>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 3D Scene */}
      <Canvas
        camera={{ position: [500, 200, 500], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#0a0a0a"]} />

        {/* Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[15, 20, 15]} intensity={1.4} />
        <pointLight position={[-10, 7, 6]} intensity={0.8} />

        {/* Room */}
        <group ref={roomRef}>
          <TripoModelLoader
            modelId={assets.room.id}
            modelType="room"
            scale={1}
            position={[0, 0, 0]}
          />
        </group>

        {/* Suspects */}
        <group ref={suspectRef}>
          {assets.suspects.map((suspect, idx) => (
            <TripoModelLoader
              key={suspect.id}
              modelId={suspect.modelId}
              modelType="suspect"
              scale={27}
              position={[idx * 10 - 5, 95, 20]}
            />
          ))}
        </group>

        {/* Lip Sync for Selected Suspect */}
        {selectedSuspect && suspectRef.current && (
          <LipSyncController
            suspectModel={suspectRef.current}
            audioUrl={assets.suspects.find((s) => s.id === selectedSuspect)?.audioUrl}
            analyzerMode="deepgram"
            autoPlay={true}
            debug={false}
          />
        )}

        {/* Camera Controls */}
        <ProfessionalControls />
        <OrbitControls />
      </Canvas>

      {/* Suspect Selection UI */}
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
                  selectedSuspect === suspect.id ? "#ffd700" : "#333",
                color: selectedSuspect === suspect.id ? "#000" : "#fff",
              }}
            >
              🕵️ {suspect.originalData.name}
            </button>
          ))}
        </div>
        <p style={styles.status}>
          {selectedSuspect
            ? "▶️ Playing suspect dialogue..."
            : "👆 Click a suspect to interrogate"}
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
