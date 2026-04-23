"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { EvidenceId, SuspectId } from "@/lib/cases/harlow-manor";
import type {
  CharacterTimestampRange,
  VisemeTimeline,
} from "@/lib/character/character-pipeline";
import SuspectCharacterScene from "@/components/character/SuspectCharacterScene";
import { ProfessionalControls } from "./ProfessionalControls";

type SceneProps = {
  suspectId: SuspectId;
  evidenceIds: readonly EvidenceId[];
  speaking: boolean;
  stressed: boolean;
  characterTimestamps?: CharacterTimestampRange[] | null;
  visemeTimeline?: VisemeTimeline | null;
  speechElapsedMs?: number;
};

function InterrogationRoomScene({
  suspectId,
  speaking,
  stressed,
  characterTimestamps,
  visemeTimeline,
  speechElapsedMs,
}: SceneProps) {
  const accent = stressed ? "#c05040" : "#D4A843";

  return (
    <group>
      <ambientLight intensity={0.08} color="#9fb0c8" />
      <directionalLight
        castShadow
        position={[0.55, 1.95, 1.35]}
        intensity={speaking ? 1.72 : 1.55}
        color="#f2ece2"
      />
      <pointLight position={[0, 1.38, 1.02]} intensity={speaking ? 1.34 : 1.1} color="#f5efe4" />
      <pointLight position={[-0.55, 1.22, 0.6]} intensity={stressed ? 0.42 : 0.18} color={accent} />
      <spotLight
        position={[0.1, 2.0, 1.55]}
        angle={0.34}
        penumbra={0.95}
        intensity={speaking ? 2.62 : 2.3}
        color="#fff7ec"
        distance={5}
        decay={1.4}
        castShadow
        target-position={[0, 1.16, -0.02]}
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

      <group position={[0, 0.42, -0.04]}>
        <SuspectCharacterScene
          suspectId={suspectId}
          speaking={speaking}
          stressed={stressed}
          characterTimestamps={characterTimestamps}
          visemeTimeline={visemeTimeline}
          speechElapsedMs={speechElapsedMs}
          presentation="standing"
        />
      </group>
    </group>
  );
}

function InterrogationRoom3D(props: SceneProps) {
  const controlsRef = useRef<any>(null);
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
        <InterrogationRoomScene {...props} />
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

export default InterrogationRoom3D;
