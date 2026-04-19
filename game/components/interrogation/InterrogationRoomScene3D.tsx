"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
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

// Room model - simple direct load
function RoomModel() {
  const { scene } = useGLTF("/models/interogation_room.glb");

  return <primitive object={scene} />;
}

// Head model - scaled and positioned
function SuspectModel({ stressed }: { stressed: boolean }) {
  const { scene } = useGLTF("/models/suspect-head.glb");

  return (
    <group position={[-5, 95, 20]} scale={[27, 27, 27]}>
      <primitive object={scene} />
    </group>
  );
}

// Simple camera setup
function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    // Position camera to see entire scene
    camera.position.set(500, 200, 500);
    camera.lookAt(0, 150, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function InterrogationScene({ suspectId, evidenceIds, stressed }: SceneProps) {
  const accent = stressed ? "#c05040" : "#D4A843";
  const evidenceSlots = evidenceIds.slice(0, 8);

  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[15, 20, 15]}
        intensity={1.4}
      />
      <pointLight position={[-10, 7, 6]} intensity={0.8} color="#ffffff" />
      <pointLight position={[5, 5, -8]} intensity={stressed ? 0.9 : 0.6} color={accent} />

      {/* Models */}
      <RoomModel />
      <SuspectModel stressed={stressed} />

      {/* Evidence */}
      {evidenceSlots.map((id, i) => {
        const spread = Math.min(Math.max(evidenceSlots.length, 1), 6);
        const idx = i % spread;
        const x = (idx - (spread - 1) / 2) * 0.3;
        const row = Math.floor(i / spread);
        const zOff = row * 0.2;
        return (
          <mesh key={`${id}-${i}`} position={[x, 1.15, 0.3 + zOff]}>
            <boxGeometry args={[0.12, 0.07, 0.15]} />
            <meshStandardMaterial color="#D4A843" roughness={0.4} metalness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function InterrogationRoom3D(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [20, 5, 20], fov: 45, near: 0.1, far: 5000 }}
      style={{ width: "100%", height: "100%" }}
      shadows
    >
      <color attach="background" args={["#0a0a0a"]} />

      <CameraSetup />
      <ProfessionalControls />
      <Suspense fallback={null}>
        <InterrogationScene {...props} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={50}
          maxDistance={1000}
          dampingFactor={0.06}
          enableDamping={true}
          rotateSpeed={0.7}
          zoomSpeed={0.08}
          panSpeed={0.5}
        />
      </Suspense>
    </Canvas>
  );
}

export default InterrogationRoom3D;
