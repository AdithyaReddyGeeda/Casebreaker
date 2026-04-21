"use client";

import { memo, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  CharacterTimestampRange,
  VisemeTimeline,
} from "@/lib/character/character-pipeline";

interface CharacterCanvasProps {
  modelPath?: string;
  speaking: boolean;
  stressed: boolean;
  visemeTimeline?: VisemeTimeline | null;
  characterTimestamps?: CharacterTimestampRange[] | null;
  speechElapsedMs?: number;
  preferredYaw?: number;
  presentation?: "standing" | "seated";
}

const TARGET_HEIGHT = 1.95;
const GROUND_CLEARANCE = 0.08;
const DEFAULT_FRONT_FACING_YAW = -Math.PI / 2;
const FACE_ANIMATION_DEBUG = true;

function LoadingFallback() {
  return (
    <group>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1, 1.8, 0.8]} />
        <meshStandardMaterial color="#d4a843" />
      </mesh>
      <Html center>
        <div
          style={{
            marginTop: 80,
            color: "#ffffff",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            pointerEvents: "none",
            userSelect: "none",
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          }}
        >
          Loading model...
        </div>
      </Html>
    </group>
  );
}

function PathFallbackFigure() {
  return (
    <group position={[0, 0.1, 0]}>
      <mesh position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.38, 1.05, 8, 16]} />
        <meshStandardMaterial color="#4A5A6B" roughness={0.7} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.88, 0.04]}>
        <sphereGeometry args={[0.19, 24, 24]} />
        <meshStandardMaterial color="#c4b4a4" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <circleGeometry args={[0.8, 36]} />
        <meshStandardMaterial color="#1a2230" />
      </mesh>
    </group>
  );
}

const MOUTH_MORPH_HINTS = [
  "viseme",
  "mouth",
  "lip",
  "jaw",
  "open",
  "mouthopen",
  "mouth_open",
  "jawopen",
  "jaw_open",
  "aa",
  "oh",
  "ou",
];

const HEAD_MESH_HINTS = [
  "head",
  "face",
  "hair",
  "brow",
  "eye",
  "lash",
  "teeth",
  "mouth",
  "tongue",
];

function pickMouthMorphIndices(dict: Record<string, number>): number[] {
  const entries = Object.entries(dict);
  const matches = entries
    .filter(([name]) =>
      MOUTH_MORPH_HINTS.some((hint) => name.toLowerCase().includes(hint))
    )
    .map(([, idx]) => idx);

  const uniqueMatches = Array.from(new Set(matches));
  if (uniqueMatches.length > 0) return uniqueMatches.slice(0, 4);

  return entries.map(([, idx]) => idx).slice(0, 2);
}

function getAllSpeechMorphIndices(dict: Record<string, number>): number[] {
  return Array.from(
    new Set(
      Object.entries(dict)
        .filter(([name]) =>
          MOUTH_MORPH_HINTS.some((hint) => name.toLowerCase().includes(hint))
        )
        .map(([, idx]) => idx)
    )
  );
}

function isHeadLikeMesh(name: string) {
  const lower = name.toLowerCase();
  return HEAD_MESH_HINTS.some((hint) => lower.includes(hint));
}

function isBodyAffectingTrack(trackName: string) {
  const name = trackName.toLowerCase();
  return (
    name.endsWith(".position") ||
    /(hips|spine|pelvis|root|armature|mixamorighips|mixamorigspine)/.test(name)
  );
}

function debugFaceAnimation(message: string, payload: Record<string, unknown>) {
  if (!FACE_ANIMATION_DEBUG) return;
  console.debug(`[character-face-animation] ${message}`, payload);
}

function getTimestampMouthInfluence(
  characterTimestamps: CharacterTimestampRange[] | null | undefined,
  elapsedMs: number
): number | null {
  if (!characterTimestamps?.length) return null;

  for (const range of characterTimestamps) {
    if (elapsedMs >= range.startMs && elapsedMs <= range.endMs) {
      return 1;
    }
  }

  return 0;
}

function getVisemeMouthInfluence(
  timeline: VisemeTimeline | null | undefined,
  elapsedMs: number
): number | null {
  if (!timeline?.events.length) return null;

  let active = timeline.events[0];
  for (const event of timeline.events) {
    if (event.timeMs <= elapsedMs) {
      active = event;
    } else {
      break;
    }
  }

  return THREE.MathUtils.clamp((active.strength || 0.9) * 0.9, 0.05, 1);
}

function getModelYaw(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes("soldier")) return Math.PI;
  return DEFAULT_FRONT_FACING_YAW;
}

function GLBCharacter({
  url,
  speakingRef,
  stressedRef,
  targetMouthInfluenceRef,
  preferredYaw,
  presentation = "standing",
}: {
  url: string;
  speakingRef: MutableRefObject<boolean>;
  stressedRef: MutableRefObject<boolean>;
  targetMouthInfluenceRef: MutableRefObject<number>;
  preferredYaw?: number;
  presentation?: "standing" | "seated";
}) {
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => clone(scene) as THREE.Group, [scene]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const hipsBoneRef = useRef<THREE.Bone | null>(null);
  const hipsInitialXRef = useRef(0);
  const hipsInitialZRef = useRef(0);
  const jawBoneRef = useRef<THREE.Bone | null>(null);
  const jawInitialXRef = useRef(0);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const headInitialXRef = useRef(0);
  const headInitialYRef = useRef(0);
  const mouthMorphTargetsRef = useRef<
    Array<{ mesh: THREE.Mesh; activeIndex: number; allIndices: number[]; meshName: string }>
  >([]);
  const hasLipRigRef = useRef(false);
  const clockRef = useRef(0);
  const finalScaleRef = useRef(1);
  const finalYOffsetRef = useRef(0);
  const centerOffsetXRef = useRef(0);
  const centerOffsetZRef = useRef(0);
  const yawRef = useRef(0);
  const seatedOffsetYRef = useRef(0);
  const seatedLeanRef = useRef(0);
  const groundBoxRef = useRef(new THREE.Box3());
  const groundSizeRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    hipsBoneRef.current = null;
    jawBoneRef.current = null;
    headBoneRef.current = null;
    mouthMorphTargetsRef.current = [];
    hasLipRigRef.current = false;

    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const bone = obj as THREE.Bone;

      if ("isMesh" in obj && obj.isMesh) {
        mesh.frustumCulled = false;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          const mouthIndices = pickMouthMorphIndices(mesh.morphTargetDictionary);
          const allSpeechIndices = getAllSpeechMorphIndices(mesh.morphTargetDictionary);
          if (mouthIndices.length > 0 && allSpeechIndices.length > 0) {
            mouthMorphTargetsRef.current.push({
              mesh,
              activeIndex: mouthIndices[0],
              allIndices: allSpeechIndices,
              meshName: mesh.name || "unnamed-morph-mesh",
            });
          }
        }
      }

      if (bone.isBone && /hips/i.test(bone.name) && !hipsBoneRef.current) {
        hipsBoneRef.current = bone;
        hipsInitialXRef.current = bone.position.x;
        hipsInitialZRef.current = bone.position.z;
      }

      if (bone.isBone && /head/i.test(bone.name) && !headBoneRef.current) {
        headBoneRef.current = bone;
        headInitialXRef.current = bone.rotation.x;
        headInitialYRef.current = bone.rotation.y;
      }

      if (bone.isBone && /(jaw|mandible)/i.test(bone.name) && !jawBoneRef.current) {
        jawBoneRef.current = bone;
        jawInitialXRef.current = bone.rotation.x;
      }
    });

    hasLipRigRef.current =
      mouthMorphTargetsRef.current.length > 0 || Boolean(jawBoneRef.current);

    clonedScene.updateWorldMatrix(true, true);

    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    let hasGeometry = false;

    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!("isMesh" in obj) || !obj.isMesh || !mesh.geometry) return;

      mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) return;

      const worldBox = mesh.geometry.boundingBox.clone();
      worldBox.applyMatrix4(mesh.matrixWorld);
      box.union(worldBox);
      hasGeometry = true;
    });

    let nextScale = 1;
    let nextY = GROUND_CLEARANCE;
    let nextCenterX = 0;
    let nextCenterZ = 0;

    if (hasGeometry) {
      box.getSize(size);
      if (Number.isFinite(size.y) && size.y > 0) {
        nextScale = TARGET_HEIGHT / size.y;
      }
      if (Number.isFinite(box.min.y)) {
        nextY = -box.min.y * nextScale + GROUND_CLEARANCE;
      }
      box.getCenter(center);
      if (Number.isFinite(center.x)) {
        nextCenterX = -center.x * nextScale;
      }
      if (Number.isFinite(center.z)) {
        nextCenterZ = -center.z * nextScale;
      }
    }

    finalScaleRef.current = THREE.MathUtils.clamp(nextScale, 0.01, 10);
    finalYOffsetRef.current = THREE.MathUtils.clamp(nextY, -5, 5);
    centerOffsetXRef.current = THREE.MathUtils.clamp(nextCenterX, -5, 5);
    centerOffsetZRef.current = THREE.MathUtils.clamp(nextCenterZ, -5, 5);
    yawRef.current = preferredYaw ?? getModelYaw(url);
    // Keep the model grounded even in "seated" presentation mode.
    // Generated characters tend to be authored as standing figures, so
    // only use a tiny seat offset and let the floor-lock logic handle
    // the final placement.
    seatedOffsetYRef.current = presentation === "seated" ? -0.02 : 0;
    seatedLeanRef.current = presentation === "seated" ? 0.045 : 0;

    clonedScene.scale.setScalar(finalScaleRef.current);
    clonedScene.position.set(centerOffsetXRef.current, 0, centerOffsetZRef.current);
    clonedScene.rotation.set(0, yawRef.current, 0);
    group.position.set(0, finalYOffsetRef.current + seatedOffsetYRef.current, 0);

    if (animations.length > 0) {
      const mixer = new THREE.AnimationMixer(clonedScene);
      mixerRef.current = mixer;

      const clip =
        animations.find((item) => item.name === "Idle") ||
        animations.find((item) => item.name.toLowerCase().includes("idle")) ||
        animations[0];

      if (clip) {
        // Strip all position tracks so imported idle clips cannot drag
        // the model down through the floor. We add our own lightweight
        // procedural motion on top of a grounded base pose.
        const stableClip = new THREE.AnimationClip(
          `${clip.name}_noRootMotion`,
          clip.duration,
          clip.tracks.filter((track) => !isBodyAffectingTrack(track.name))
        );

        const action = mixer.clipAction(stableClip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();

        debugFaceAnimation("filtered-animation-tracks", {
          url,
          originalTrackCount: clip.tracks.length,
          keptTrackCount: stableClip.tracks.length,
          removedTracks: clip.tracks
            .map((track) => track.name)
            .filter((name) => isBodyAffectingTrack(name)),
        });
      }
    }

    const debugJawBoneName = jawBoneRef.current
      ? (jawBoneRef.current as THREE.Bone).name
      : null;
    const debugHeadBoneName = headBoneRef.current
      ? (headBoneRef.current as THREE.Bone).name
      : null;

    debugFaceAnimation("resolved-face-animation-targets", {
      url,
      morphMeshes: mouthMorphTargetsRef.current.map((entry) => ({
        meshName: entry.meshName,
        activeIndex: entry.activeIndex,
        allIndices: entry.allIndices,
      })),
      jawBone: debugJawBoneName,
      headBone: debugHeadBoneName,
      fallbackMode:
        mouthMorphTargetsRef.current.length > 0
          ? "morphTargets"
          : jawBoneRef.current
            ? "jawBone"
            : headBoneRef.current
              ? "headBone"
              : "none",
    });

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [animations, clonedScene, url]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);

    if (!groupRef.current) return;

    if (hipsBoneRef.current) {
      hipsBoneRef.current.position.x = hipsInitialXRef.current;
      hipsBoneRef.current.position.z = hipsInitialZRef.current;
    }

    clonedScene.position.set(centerOffsetXRef.current, 0, centerOffsetZRef.current);
    clonedScene.rotation.set(0, yawRef.current, 0);

    clockRef.current = (clockRef.current + delta) % 6283;
    const t = clockRef.current;
    const baseY = finalYOffsetRef.current + seatedOffsetYRef.current;

    const mouthTarget = speakingRef.current
      ? THREE.MathUtils.clamp(targetMouthInfluenceRef.current, 0, 1)
      : 0;

    if (mouthMorphTargetsRef.current.length > 0) {
      for (const entry of mouthMorphTargetsRef.current) {
        const influences = entry.mesh.morphTargetInfluences;
        if (!Array.isArray(influences)) continue;
        for (const idx of entry.allIndices) {
          const current = influences[idx] ?? 0;
          const targetValue = idx === entry.activeIndex ? mouthTarget : 0;
          Reflect.set(influences, idx, THREE.MathUtils.lerp(current, targetValue, 0.28));
        }
      }
    } else if (jawBoneRef.current) {
      const jawTarget = speakingRef.current ? mouthTarget * 0.35 : 0;
      jawBoneRef.current.rotation.x = THREE.MathUtils.lerp(
        jawBoneRef.current.rotation.x,
        THREE.MathUtils.clamp(jawInitialXRef.current - jawTarget, -0.1, 0.1),
        0.28
      );
    }

    if (speakingRef.current) {
      groupRef.current.position.y = baseY;
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.x = seatedLeanRef.current;

      if (headBoneRef.current) {
        const pulse = 0.35 + Math.abs(Math.sin(t * 10.2));
        headBoneRef.current.rotation.x = THREE.MathUtils.lerp(
          headBoneRef.current.rotation.x,
          THREE.MathUtils.clamp(
            headInitialXRef.current + Math.sin(t * 11.5) * (0.03 * pulse),
            -0.1,
            0.1
          ),
          0.32
        );
        headBoneRef.current.rotation.y = THREE.MathUtils.lerp(
          headBoneRef.current.rotation.y,
          THREE.MathUtils.clamp(
            headInitialYRef.current + Math.sin(t * 6.2) * 0.02,
            -0.1,
            0.1
          ),
          0.3
        );
      }
    } else if (stressedRef.current) {
      groupRef.current.position.y = baseY + Math.sin(t * 3) * 0.015;
      groupRef.current.rotation.y = Math.sin(t * 1.5) * 0.1;
      groupRef.current.rotation.x = Math.sin(t * 2) * 0.02 + seatedLeanRef.current;
    } else {
      groupRef.current.position.y = baseY + Math.sin(t * 1.2) * 0.005;
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.x = seatedLeanRef.current;
      clonedScene.rotation.y = yawRef.current;
      clonedScene.rotation.x = 0;

      if (headBoneRef.current) {
        headBoneRef.current.rotation.x = THREE.MathUtils.lerp(
          headBoneRef.current.rotation.x,
          headInitialXRef.current,
          0.16
        );
        headBoneRef.current.rotation.y = THREE.MathUtils.lerp(
          headBoneRef.current.rotation.y,
          headInitialYRef.current,
          0.16
        );
      }
    }

    // Final safety pass: keep the animated/scaled model above the floor.
    // Some generated rigs still shift vertically after load, so we measure
    // the current bounds and gently push the whole presentation up if any
    // part clips below ground.
    const groundBox = groundBoxRef.current;
    groundBox.setFromObject(groupRef.current);
    groundBox.getSize(groundSizeRef.current);

    if (
      Number.isFinite(groundBox.min.y) &&
      Number.isFinite(groundSizeRef.current.y) &&
      groundSizeRef.current.y > 0
    ) {
      const correction = GROUND_CLEARANCE - groundBox.min.y;
      if (correction > 0.001) {
        groupRef.current.position.y += Math.min(correction, 0.14);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

const StableGLBModel = memo(
  GLBCharacter,
  (prev, next) =>
    prev.url === next.url &&
    prev.speakingRef === next.speakingRef &&
    prev.stressedRef === next.stressedRef &&
    prev.targetMouthInfluenceRef === next.targetMouthInfluenceRef
);

export default function CharacterCanvas({
  modelPath,
  speaking,
  stressed,
  visemeTimeline,
  characterTimestamps,
  speechElapsedMs = 0,
  preferredYaw,
  presentation = "standing",
}: CharacterCanvasProps) {
  const hasModelPath = typeof modelPath === "string" && modelPath.trim().length > 0;
  const speakingRef = useRef(speaking);
  const stressedRef = useRef(stressed);
  const targetMouthInfluenceRef = useRef(0);

  useEffect(() => {
    speakingRef.current = speaking;
    stressedRef.current = stressed;
  }, [speaking, stressed]);

  useEffect(() => {
    if (!speaking) {
      targetMouthInfluenceRef.current = 0;
      return;
    }

    const influence = getTimestampMouthInfluence(characterTimestamps, speechElapsedMs);
    targetMouthInfluenceRef.current =
      influence ?? getVisemeMouthInfluence(visemeTimeline, speechElapsedMs) ?? 0;
  }, [characterTimestamps, speechElapsedMs, speaking, visemeTimeline]);

  useEffect(() => {
    if (!hasModelPath) return;
    useGLTF.preload(modelPath.trim());
  }, [hasModelPath, modelPath]);

  if (!hasModelPath) {
    return <PathFallbackFigure />;
  }

  return (
    <group>
      <StableGLBModel
        url={modelPath.trim()}
        speakingRef={speakingRef}
        stressedRef={stressedRef}
        targetMouthInfluenceRef={targetMouthInfluenceRef}
        preferredYaw={preferredYaw}
        presentation={presentation}
      />
    </group>
  );
}

export { LoadingFallback };
