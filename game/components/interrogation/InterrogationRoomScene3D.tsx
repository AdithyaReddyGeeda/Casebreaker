"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import { ProfessionalControls } from "./ProfessionalControls";

const SUSPECT_TINT: Record<SuspectId, string> = {
  fenn: "#4A6670",
  victoria: "#6B4A5A",
  oliver: "#4A5A6B",
};

type SceneProps = {
  suspectId: SuspectId;
  evidenceIds: readonly EvidenceId[];
  stressed: boolean;
};

/** Procedural room + figure — no external .glb (optional: drop models under public/models/ later). */
function InterrogationPlaceholderScene({ suspectId, evidenceIds, stressed }: SceneProps) {
  const tint = SUSPECT_TINT[suspectId];
  const accent = stressed ? "#c05040" : "#D4A843";
  const evidenceSlots = useMemo(() => evidenceIds.slice(0, 8), [evidenceIds]);

  return (
    <group>
      <ambientLight intensity={0.45} />
      <directionalLight castShadow position={[3.5, 6, 4]} intensity={1.15} />
      <pointLight position={[-2.5, 2.5, 1.5]} intensity={stressed ? 0.55 : 0.35} color={accent} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#070e14" roughness={0.92} metalness={0.05} />
      </mesh>

      <group position={[0, 0, -0.42]}>
        <mesh castShadow position={[0, 0.22, 0]}>
          <boxGeometry args={[0.52, 0.42, 0.09]} />
          <meshStandardMaterial color="#2a2220" roughness={0.75} />
        </mesh>
        <mesh castShadow position={[0, 0.02, 0.2]}>
          <boxGeometry args={[0.52, 0.08, 0.42]} />
          <meshStandardMaterial color="#2a2220" roughness={0.75} />
        </mesh>
      </group>

      <group position={[0, 0.12, -0.18]} rotation={[0.12, 0, 0]}>
        <mesh castShadow position={[0, 0.32, 0]}>
          <boxGeometry args={[0.34, 0.52, 0.22]} />
          <meshStandardMaterial
            color={tint}
            roughness={0.62}
            metalness={0.12}
            emissive={tint}
            emissiveIntensity={0.12}
          />
        </mesh>
        <mesh castShadow position={[0, 0.72, 0.04]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color="#c4b4a4" roughness={0.55} />
        </mesh>
      </group>

      <group position={[0, 0, 0.38]}>
        <mesh castShadow position={[0, 0.52, 0]}>
          <boxGeometry args={[1.2, 0.06, 0.52]} />
          <meshStandardMaterial color="#1a1412" roughness={0.55} metalness={0.15} />
        </mesh>
        {[
          [-0.48, 0.22],
          [0.48, 0.22],
          [-0.48, -0.22],
          [0.48, -0.22],
        ].map(([x, z], i) => (
          <mesh key={i} castShadow position={[x, 0.24, z]}>
            <cylinderGeometry args={[0.04, 0.045, 0.48, 8]} />
            <meshStandardMaterial color="#14100e" roughness={0.65} />
          </mesh>
        ))}
      </group>

      {evidenceSlots.map((id, i) => {
        const spread = Math.min(Math.max(evidenceSlots.length, 1), 6);
        const idx = i % spread;
        const x = (idx - (spread - 1) / 2) * 0.22;
        const row = Math.floor(i / spread);
        const zOff = row * 0.14;
        return (
          <mesh key={`${id}-${i}`} castShadow position={[x, 0.58, 0.38 + zOff]}>
            <boxGeometry args={[0.1, 0.06, 0.12]} />
            <meshStandardMaterial color="#D4A843" roughness={0.4} metalness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function InterrogationRoom3D(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [2.2, 1.35, 2.8], fov: 45, near: 0.1, far: 100 }}
      style={{ width: "100%", height: "100%" }}
      shadows
    >
      <color attach="background" args={["#0a0f14"]} />
      <ProfessionalControls />
      <Suspense fallback={null}>
        <InterrogationPlaceholderScene {...props} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={0.85}
          maxDistance={9}
          dampingFactor={0.06}
          enableDamping
          rotateSpeed={0.7}
          zoomSpeed={0.08}
          panSpeed={0.5}
        />
      </Suspense>
    </Canvas>
  );
}

export default InterrogationRoom3D;
