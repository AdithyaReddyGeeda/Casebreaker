"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type OrbitControlsLike = {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
};

interface ProfessionalControlsProps {
  controlsRef: React.MutableRefObject<OrbitControlsLike | null>;
  focusTarget: [number, number, number];
  defaultCameraPosition: [number, number, number];
}

interface CameraTweenState {
  active: boolean;
  startedAt: number;
  durationMs: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

const FOCUS_DISTANCE = 2.26;
const FOCUS_HEIGHT = 0.08;
const FOCUS_SIDE = 0.02;
const RESET_DURATION_MS = 650;
const FOCUS_DURATION_MS = 550;

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function ProfessionalControls({
  controlsRef,
  focusTarget,
  defaultCameraPosition,
}: ProfessionalControlsProps) {
  const { camera, gl } = useThree();
  const focusPoint = useMemo(
    () => new THREE.Vector3(...focusTarget),
    [focusTarget]
  );
  const defaultPosition = useMemo(
    () => new THREE.Vector3(...defaultCameraPosition),
    [defaultCameraPosition]
  );
  const defaultTargetRef = useRef(focusPoint.clone());
  const initializedRef = useRef(false);
  const previousLayoutKeyRef = useRef("");
  const tweenRef = useRef<CameraTweenState>({
    active: false,
    startedAt: 0,
    durationMs: 0,
    fromPosition: defaultPosition.clone(),
    toPosition: defaultPosition.clone(),
    fromTarget: focusPoint.clone(),
    toTarget: focusPoint.clone(),
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const layoutKey = `${focusPoint.x}:${focusPoint.y}:${focusPoint.z}|${defaultPosition.x}:${defaultPosition.y}:${defaultPosition.z}`;
    if (initializedRef.current && previousLayoutKeyRef.current === layoutKey) {
      return;
    }

    controls.target.copy(focusPoint);
    camera.position.copy(defaultPosition);
    camera.lookAt(focusPoint);
    controls.update();

    defaultTargetRef.current.copy(focusPoint);
    initializedRef.current = true;
    previousLayoutKeyRef.current = layoutKey;
  }, [camera, controlsRef, defaultPosition, focusPoint]);

  const startTween = (
    nextPosition: THREE.Vector3,
    nextTarget: THREE.Vector3,
    durationMs: number
  ) => {
    const controls = controlsRef.current;
    if (!controls) return;

    tweenRef.current = {
      active: true,
      startedAt: performance.now(),
      durationMs,
      fromPosition: camera.position.clone(),
      toPosition: nextPosition.clone(),
      fromTarget: controls.target.clone(),
      toTarget: nextTarget.clone(),
    };
  };

  useEffect(() => {
    const canvas = gl.domElement;

    const focusSuspect = () => {
      const nextTarget = focusPoint.clone();
      const nextPosition = new THREE.Vector3(
        nextTarget.x + FOCUS_SIDE,
        nextTarget.y + FOCUS_HEIGHT,
        nextTarget.z + FOCUS_DISTANCE
      );
      startTween(nextPosition, nextTarget, FOCUS_DURATION_MS);
    };

    const resetView = () => {
      startTween(defaultPosition, defaultTargetRef.current, RESET_DURATION_MS);
    };

    const onDoubleClick = () => {
      focusSuspect();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      const isTyping =
        element &&
        (element.tagName === "INPUT" ||
          element.tagName === "TEXTAREA" ||
          element.tagName === "SELECT" ||
          element.isContentEditable);
      if (isTyping) return;

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        focusSuspect();
      }

      if (event.key.toLowerCase() === "r" || event.key === "Escape") {
        event.preventDefault();
        resetView();
      }
    };

    canvas.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [controlsRef, defaultPosition, focusPoint, gl]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const tween = tweenRef.current;
    if (tween.active) {
      const elapsed = performance.now() - tween.startedAt;
      const t = Math.min(1, elapsed / tween.durationMs);
      const eased = easeOutCubic(t);

      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      controls.update();

      if (t >= 1) {
        tween.active = false;
      }
      return;
    }

    controls.update();
  });

  return null;
}

export default ProfessionalControls;
