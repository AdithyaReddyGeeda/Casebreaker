"use client";

import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
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
  "ah",
  "ee",
  "oh",
  "oo",
  "ou",
  "smile",
];

const BLINK_MORPH_HINTS = [
  "blink",
  "eyeblink",
  "eye_blink",
  "lid",
  "eyelid",
  "close",
];

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

function getActiveVisemeName(
  timeline: VisemeTimeline | null | undefined,
  elapsedMs: number
): string {
  if (!timeline?.events.length) return "open";

  let active = timeline.events[0];
  for (const event of timeline.events) {
    if (event.timeMs <= elapsedMs) {
      active = event;
    } else {
      break;
    }
  }

  return active.viseme?.toLowerCase() || "open";
}

type FacialMorphTarget = {
  name: string;
  index: number;
};

type MorphLipSyncTarget = {
  mode: "morph";
  mesh: THREE.Mesh;
  meshName: string;
  morphTargets: FacialMorphTarget[];
  blinkTargets: FacialMorphTarget[];
  jawBone: THREE.Bone | null;
  headBone: THREE.Bone | null;
  neckBone: THREE.Bone | null;
  chestBone: THREE.Bone | null;
};

type JawLipSyncTarget = {
  mode: "jaw";
  mesh: null;
  meshName: null;
  morphTargets: [];
  blinkTargets: FacialMorphTarget[];
  jawBone: THREE.Bone;
  headBone: THREE.Bone | null;
  neckBone: THREE.Bone | null;
  chestBone: THREE.Bone | null;
};

type HeadLipSyncTarget = {
  mode: "head";
  mesh: null;
  meshName: null;
  morphTargets: [];
  blinkTargets: FacialMorphTarget[];
  jawBone: null;
  headBone: THREE.Bone;
  neckBone: THREE.Bone | null;
  chestBone: THREE.Bone | null;
};

type EmptyLipSyncTarget = {
  mode: "none";
  mesh: null;
  meshName: null;
  morphTargets: [];
  blinkTargets: FacialMorphTarget[];
  jawBone: null;
  headBone: null;
  neckBone: null;
  chestBone: null;
};

type LipSyncTarget = MorphLipSyncTarget | JawLipSyncTarget | HeadLipSyncTarget | EmptyLipSyncTarget;

function findFacialMorphTargets(dict: Record<string, number>): FacialMorphTarget[] {
  return Object.entries(dict)
    .filter(([name]) => {
      const lower = name.toLowerCase();
      return MOUTH_MORPH_HINTS.some((hint) => lower.includes(hint));
    })
    .map(([name, index]) => ({ name, index }));
}

function findBlinkMorphTargets(dict: Record<string, number>): FacialMorphTarget[] {
  return Object.entries(dict)
    .filter(([name]) => {
      const lower = name.toLowerCase();
      return BLINK_MORPH_HINTS.some((hint) => lower.includes(hint));
    })
    .map(([name, index]) => ({ name, index }));
}

function findBestMorphTarget(targets: FacialMorphTarget[], cue: string): FacialMorphTarget {
  const lowerCue = cue.toLowerCase();
  const direct = targets.find((target) => target.name.toLowerCase().includes(lowerCue));
  if (direct) return direct;

  const open =
    targets.find((target) => /open|jaw|mouth|viseme|aa|ah/i.test(target.name)) ?? targets[0];

  return open;
}

function resolveLipSyncTarget(root: THREE.Group): LipSyncTarget {
  const morphCandidates: MorphLipSyncTarget[] = [];
  let jawBone: THREE.Bone | null = null;
  let headBone: THREE.Bone | null = null;
  let neckBone: THREE.Bone | null = null;
  let chestBone: THREE.Bone | null = null;
  const blinkTargets: FacialMorphTarget[] = [];
  const relevantBones: string[] = [];
  const meshDebug: Array<{
    meshName: string;
    hasMorphTargetInfluences: boolean;
    morphTargetKeys: string[];
  }> = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const bone = obj as THREE.Bone;

    if ("isMesh" in obj && obj.isMesh) {
      const morphTargetKeys = mesh.morphTargetDictionary
        ? Object.keys(mesh.morphTargetDictionary)
        : [];
      const hasMorphTargetInfluences = Array.isArray(mesh.morphTargetInfluences);
      meshDebug.push({
        meshName: mesh.name || "unnamed-mesh",
        hasMorphTargetInfluences,
        morphTargetKeys,
      });

      if (mesh.morphTargetDictionary && hasMorphTargetInfluences) {
        const morphTargets = findFacialMorphTargets(mesh.morphTargetDictionary);
        const meshBlinkTargets = findBlinkMorphTargets(mesh.morphTargetDictionary);
        if (meshBlinkTargets.length > 0 && blinkTargets.length === 0) {
          blinkTargets.push(...meshBlinkTargets);
        }
        if (morphTargets.length > 0) {
          morphCandidates.push({
            mode: "morph",
            mesh,
            meshName: mesh.name || "unnamed-morph-mesh",
            morphTargets,
            blinkTargets: meshBlinkTargets,
            jawBone: null,
            headBone: null,
            neckBone: null,
            chestBone: null,
          });
        }
      }
    }

    if (bone.isBone) {
      const lower = bone.name.toLowerCase();
      if (/(head|neck|jaw|mandible|face|chest|spine|hips|pelvis|root)/.test(lower)) {
        relevantBones.push(bone.name || "unnamed-bone");
      }

      if (!jawBone && /(jaw|mandible)/i.test(bone.name)) {
        jawBone = bone;
      }

      if (!headBone && /(head|neck)/i.test(bone.name)) {
        headBone = bone;
      }

      if (!neckBone && /neck/i.test(bone.name)) {
        neckBone = bone;
      }

      if (!chestBone && /(chest|upper.*spine|spine2|spine_02|spine02)/i.test(bone.name)) {
        chestBone = bone;
      }
    }
  });

  const selectedMorph = morphCandidates
    .sort((a, b) => b.morphTargets.length - a.morphTargets.length)[0];

  let target: LipSyncTarget;
  if (selectedMorph) {
    target = {
      ...selectedMorph,
      blinkTargets: selectedMorph.blinkTargets.length > 0 ? selectedMorph.blinkTargets : blinkTargets,
      jawBone,
      headBone,
      neckBone,
      chestBone,
    };
  } else if (jawBone) {
    target = {
      mode: "jaw",
      mesh: null,
      meshName: null,
      morphTargets: [],
      blinkTargets,
      jawBone,
      headBone,
      neckBone,
      chestBone,
    };
  } else if (headBone) {
    target = {
      mode: "head",
      mesh: null,
      meshName: null,
      morphTargets: [],
      blinkTargets,
      jawBone: null,
      headBone,
      neckBone,
      chestBone,
    };
  } else {
    target = {
      mode: "none",
      mesh: null,
      meshName: null,
      morphTargets: [],
      blinkTargets,
      jawBone: null,
      headBone: null,
      neckBone: null,
      chestBone: null,
    };
  }

  debugFaceAnimation("rig-structure", {
    meshes: meshDebug,
    relevantBones,
  });

  debugFaceAnimation("selected-lip-sync-target", {
    mode: target.mode,
    meshName: target.meshName,
    morphTargetNames: target.morphTargets.map((item) => item.name),
    blinkTargetNames: target.blinkTargets.map((item) => item.name),
    jawBone: target.jawBone?.name ?? null,
    headBone: target.headBone?.name ?? null,
    neckBone: target.neckBone?.name ?? null,
    chestBone: target.chestBone?.name ?? null,
  });

  if (target.mode === "none") {
    console.warn("No facial morph targets or jaw/head bones found for lip-sync");
    debugFaceAnimation("fallback-speaking-indicator-active", {
      mode: "none",
      reason: "No usable facial rig. Body animation disabled; using indicator only.",
    });
  } else {
    debugFaceAnimation("fallback-speaking-motion-capabilities", {
      mode: target.mode,
      headMotion: Boolean(target.headBone),
      neckMotion: Boolean(target.neckBone),
      chestMotion: Boolean(target.chestBone),
      blinkMotion: target.blinkTargets.length > 0,
    });
  }

  return target;
}

function getModelYaw(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes("soldier")) return Math.PI;
  return DEFAULT_FRONT_FACING_YAW;
}

function GLBCharacter({
  url,
  speaking,
  speakingRef,
  stressedRef,
  targetMouthInfluenceRef,
  activeVisemeRef,
  preferredYaw,
  presentation = "standing",
}: {
  url: string;
  speaking: boolean;
  speakingRef: MutableRefObject<boolean>;
  stressedRef: MutableRefObject<boolean>;
  targetMouthInfluenceRef: MutableRefObject<number>;
  activeVisemeRef: MutableRefObject<string>;
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
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const neckInitialXRef = useRef(0);
  const chestBoneRef = useRef<THREE.Bone | null>(null);
  const chestInitialXRef = useRef(0);
  const lipSyncTargetRef = useRef<LipSyncTarget>({
    mode: "none",
    mesh: null,
    meshName: null,
    morphTargets: [],
    blinkTargets: [],
    jawBone: null,
    headBone: null,
    neckBone: null,
    chestBone: null,
  });
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
  const [lipSyncMode, setLipSyncMode] = useState<LipSyncTarget["mode"]>("none");

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    hipsBoneRef.current = null;
    jawBoneRef.current = null;
    headBoneRef.current = null;
    neckBoneRef.current = null;
    chestBoneRef.current = null;

    clonedScene.traverse((obj) => {
      const bone = obj as THREE.Bone;

      if ("isMesh" in obj && obj.isMesh) {
        (obj as THREE.Mesh).frustumCulled = false;
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

    const lipSyncTarget = resolveLipSyncTarget(clonedScene);
    lipSyncTargetRef.current = lipSyncTarget;
    setLipSyncMode(lipSyncTarget.mode);
    jawBoneRef.current = lipSyncTarget.jawBone;
    headBoneRef.current = lipSyncTarget.headBone;
    neckBoneRef.current = lipSyncTarget.neckBone;
    chestBoneRef.current = lipSyncTarget.chestBone;

    if (jawBoneRef.current) {
      jawInitialXRef.current = jawBoneRef.current.rotation.x;
    }

    if (headBoneRef.current) {
      headInitialXRef.current = headBoneRef.current.rotation.x;
      headInitialYRef.current = headBoneRef.current.rotation.y;
    }

    if (neckBoneRef.current) {
      neckInitialXRef.current = neckBoneRef.current.rotation.x;
    }

    if (chestBoneRef.current) {
      chestInitialXRef.current = chestBoneRef.current.rotation.x;
    }

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

    const lipSyncTarget = lipSyncTargetRef.current;

    if (lipSyncTarget.mode === "morph") {
      const influences = lipSyncTarget.mesh.morphTargetInfluences;
      if (Array.isArray(influences)) {
        const activeTarget = findBestMorphTarget(
          lipSyncTarget.morphTargets,
          activeVisemeRef.current
        );
        for (const target of lipSyncTarget.morphTargets) {
          const current = influences[target.index] ?? 0;
          const targetValue = speakingRef.current && target.index === activeTarget.index
            ? THREE.MathUtils.clamp(mouthTarget, 0.15, 1)
            : 0;
          Reflect.set(
            influences,
            target.index,
            THREE.MathUtils.lerp(current, targetValue, 0.32)
          );
        }

        const blinkPhase = t % 4.8;
        const blinkAmount =
          speakingRef.current && blinkPhase < 0.14
            ? Math.sin((blinkPhase / 0.14) * Math.PI)
            : 0;
        for (const target of lipSyncTarget.blinkTargets) {
          const current = influences[target.index] ?? 0;
          Reflect.set(
            influences,
            target.index,
            THREE.MathUtils.lerp(current, blinkAmount, 0.35)
          );
        }

        if (speakingRef.current && Math.floor(t * 4) % 12 === 0) {
          debugFaceAnimation("active-mouth-cue", {
            mode: lipSyncTarget.mode,
            meshName: lipSyncTarget.meshName,
            activeMorphTarget: activeTarget.name,
            activeViseme: activeVisemeRef.current,
            mouthTarget,
          });
        }
      }
    } else if (lipSyncTarget.mode === "jaw") {
      const jawTarget = speakingRef.current ? mouthTarget * 0.35 : 0;
      lipSyncTarget.jawBone.rotation.x = THREE.MathUtils.lerp(
        lipSyncTarget.jawBone.rotation.x,
        THREE.MathUtils.clamp(jawInitialXRef.current + jawTarget, 0, 0.18),
        0.28
      );

      if (speakingRef.current && Math.floor(t * 4) % 12 === 0) {
        debugFaceAnimation("active-mouth-cue", {
          mode: lipSyncTarget.mode,
          jawBone: lipSyncTarget.jawBone.name,
          jawRotationX: lipSyncTarget.jawBone.rotation.x,
          activeViseme: activeVisemeRef.current,
          mouthTarget,
        });
      }
    }

    if (speakingRef.current) {
      groupRef.current.position.y = baseY;
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.x = seatedLeanRef.current;

      if (lipSyncTarget.headBone) {
        const speechPulse = Math.max(0.25, mouthTarget);
        const pulse = speechPulse * (0.35 + Math.abs(Math.sin(t * 10.2)));
        lipSyncTarget.headBone.rotation.x = THREE.MathUtils.lerp(
          lipSyncTarget.headBone.rotation.x,
          THREE.MathUtils.clamp(
            headInitialXRef.current + Math.sin(t * 11.5) * (0.018 * pulse),
            headInitialXRef.current - 0.02,
            headInitialXRef.current + 0.04
          ),
          0.32
        );
        lipSyncTarget.headBone.rotation.y = THREE.MathUtils.lerp(
          lipSyncTarget.headBone.rotation.y,
          THREE.MathUtils.clamp(
            headInitialYRef.current + Math.sin(t * 6.2) * (0.012 * speechPulse),
            headInitialYRef.current - 0.015,
            headInitialYRef.current + 0.015
          ),
          0.25
        );
      }

      if (lipSyncTarget.neckBone) {
        lipSyncTarget.neckBone.rotation.x = THREE.MathUtils.lerp(
          lipSyncTarget.neckBone.rotation.x,
          THREE.MathUtils.clamp(
            neckInitialXRef.current + Math.sin(t * 3.1) * 0.006,
            neckInitialXRef.current - 0.01,
            neckInitialXRef.current + 0.01
          ),
          0.18
        );
      }

      if (lipSyncTarget.chestBone) {
        lipSyncTarget.chestBone.rotation.x = THREE.MathUtils.lerp(
          lipSyncTarget.chestBone.rotation.x,
          THREE.MathUtils.clamp(
            chestInitialXRef.current + Math.sin(t * 2.2) * 0.0035,
            chestInitialXRef.current - 0.006,
            chestInitialXRef.current + 0.006
          ),
          0.14
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
      if (neckBoneRef.current) {
        neckBoneRef.current.rotation.x = THREE.MathUtils.lerp(
          neckBoneRef.current.rotation.x,
          neckInitialXRef.current,
          0.14
        );
      }
      if (chestBoneRef.current) {
        chestBoneRef.current.rotation.x = THREE.MathUtils.lerp(
          chestBoneRef.current.rotation.x,
          chestInitialXRef.current,
          0.12
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
      {speaking && lipSyncMode === "none" && (
        <Html position={[0, TARGET_HEIGHT + 0.16, 0]} center>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 7px",
              border: "1px solid rgba(212,168,67,0.35)",
              borderRadius: 999,
              background: "rgba(7,14,26,0.76)",
              color: "#D4A843",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              pointerEvents: "none",
              userSelect: "none",
              boxShadow: "0 0 14px rgba(212,168,67,0.12)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#D4A843",
                animation: "pulse 0.85s ease-in-out infinite",
              }}
            />
            Speaking
          </div>
        </Html>
      )}
    </group>
  );
}

const StableGLBModel = memo(
  GLBCharacter,
  (prev, next) =>
    prev.url === next.url &&
    prev.speaking === next.speaking &&
    prev.speakingRef === next.speakingRef &&
    prev.stressedRef === next.stressedRef &&
    prev.targetMouthInfluenceRef === next.targetMouthInfluenceRef &&
    prev.activeVisemeRef === next.activeVisemeRef
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
  const activeVisemeRef = useRef("open");

  useEffect(() => {
    speakingRef.current = speaking;
    stressedRef.current = stressed;
  }, [speaking, stressed]);

  useEffect(() => {
    if (!speaking) {
      targetMouthInfluenceRef.current = 0;
      activeVisemeRef.current = "open";
      return;
    }

    const influence = getTimestampMouthInfluence(characterTimestamps, speechElapsedMs);
    targetMouthInfluenceRef.current =
      influence ?? getVisemeMouthInfluence(visemeTimeline, speechElapsedMs) ?? 0;
    activeVisemeRef.current = getActiveVisemeName(visemeTimeline, speechElapsedMs);
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
        speaking={speaking}
        speakingRef={speakingRef}
        stressedRef={stressedRef}
        targetMouthInfluenceRef={targetMouthInfluenceRef}
        activeVisemeRef={activeVisemeRef}
        preferredYaw={preferredYaw}
        presentation={presentation}
      />
    </group>
  );
}

export { LoadingFallback };
