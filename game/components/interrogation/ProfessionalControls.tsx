"use client";

import { useEffect, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONTROLS_CONFIG } from "./CONTROLS_CONFIG";

interface AnimationState {
  isAnimating: boolean;
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  duration: number;
  elapsed: number;
}

interface GestureState {
  lastClickTime: number;
  clickCount: number;
  lastScrollTime: number;
  scrollCount: number;
  isDragging: boolean;
  dragStart: { x: number; y: number };
  momentumVelocity: THREE.Vector3;
  isApplyingMomentum: boolean;
}

interface HotspotState {
  hovered: THREE.Object3D | null;
  glowMesh: THREE.Mesh | null;
}

// Use configuration file for all settings
const INTERACTIONS = {
  // Core camera speeds
  DAMPING_FACTOR: CONTROLS_CONFIG.CAMERA.DAMPING_FACTOR,
  ROTATE_SPEED: CONTROLS_CONFIG.CAMERA.ROTATE_SPEED,
  ZOOM_SPEED: CONTROLS_CONFIG.CAMERA.ZOOM_SPEED,
  PAN_SPEED: CONTROLS_CONFIG.CAMERA.PAN_SPEED,

  // Animation durations (ms)
  DOUBLE_CLICK_DURATION: CONTROLS_CONFIG.ANIMATIONS.DOUBLE_CLICK_DURATION,
  DOUBLE_SCROLL_DURATION: CONTROLS_CONFIG.ANIMATIONS.DOUBLE_SCROLL_DURATION,
  RESET_DURATION: CONTROLS_CONFIG.ANIMATIONS.RESET_DURATION,

  // Zoom limits
  MIN_ZOOM: CONTROLS_CONFIG.CAMERA.MIN_ZOOM,
  MAX_ZOOM: CONTROLS_CONFIG.CAMERA.MAX_ZOOM,

  // Interaction timing
  DOUBLE_CLICK_THRESHOLD: CONTROLS_CONFIG.GESTURES.DOUBLE_CLICK_THRESHOLD,
  DOUBLE_SCROLL_THRESHOLD: CONTROLS_CONFIG.GESTURES.DOUBLE_SCROLL_THRESHOLD,

  // Momentum
  MOMENTUM_FRICTION: CONTROLS_CONFIG.GESTURES.MOMENTUM_FRICTION,
  MOMENTUM_MIN_VELOCITY: CONTROLS_CONFIG.GESTURES.MOMENTUM_MIN_VELOCITY,

  // Hotspot
  HOTSPOT_GLOW_INTENSITY: 2.0,
  HOTSPOT_GLOW_COLOR: CONTROLS_CONFIG.VISUALS.HOTSPOT_GLOW.COLOR,
  HOTSPOT_GLOW_OPACITY: CONTROLS_CONFIG.VISUALS.HOTSPOT_GLOW.OPACITY,
  HOTSPOT_RADIUS_MULTIPLIER: CONTROLS_CONFIG.VISUALS.HOTSPOT_GLOW.RADIUS_MULTIPLIER,
};

export function ProfessionalControls() {
  const { camera, gl, raycaster, scene } = useThree();
  const controlsRef = useRef<any>(null);

  // State refs
  const animStateRef = useRef<AnimationState>({
    isAnimating: false,
    startPos: camera.position.clone(),
    startQuat: camera.quaternion.clone(),
    targetPos: camera.position.clone(),
    targetQuat: camera.quaternion.clone(),
    duration: 0,
    elapsed: 0,
  });

  const gestureStateRef = useRef<GestureState>({
    lastClickTime: 0,
    clickCount: 0,
    lastScrollTime: 0,
    scrollCount: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    momentumVelocity: new THREE.Vector3(),
    isApplyingMomentum: false,
  });

  const hotspotStateRef = useRef<HotspotState>({
    hovered: null,
    glowMesh: null,
  });

  const initialCamPosRef = useRef(camera.position.clone());
  const initialCamQuatRef = useRef(camera.quaternion.clone());
  const spaceDownRef = useRef(false);
  const shiftDownRef = useRef(false);

  // ========== HELPER: Smooth camera animation ==========
  const animateCamera = (targetPos: THREE.Vector3, targetQuat: THREE.Quaternion, duration: number) => {
    const animState = animStateRef.current;
    animState.isAnimating = true;
    animState.startPos = camera.position.clone();
    animState.startQuat = camera.quaternion.clone();
    animState.targetPos = targetPos.clone();
    animState.targetQuat = targetQuat.clone();
    animState.duration = duration;
    animState.elapsed = 0;
  };

  // ========== HELPER: Raycaster hotspot detection ==========
  const getHotspotAtPoint = (x: number, y: number): THREE.Object3D | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const normalX = ((x - rect.left) / rect.width) * 2 - 1;
    const normalY = -((y - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(normalX, normalY), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Filter for interactive meshes based on config
    for (const intersection of intersects) {
      const obj = intersection.object;
      const name = obj.name.toLowerCase();

      for (const interactiveName of CONTROLS_CONFIG.HOTSPOTS.INTERACTIVE_NAMES) {
        if (name.includes(interactiveName.toLowerCase())) {
          return obj;
        }
      }
    }
    return null;
  };

  // ========== HELPER: Add glow effect to object ==========
  const createGlowEffect = (obj: THREE.Object3D): THREE.Mesh | null => {
    if (!("isMesh" in obj) || !obj.isMesh || !CONTROLS_CONFIG.PERFORMANCE.ENABLE_GLOW) {
      return null;
    }

    const mesh = obj as THREE.Mesh;
    if (!mesh.geometry) return null;

    // Create glow sphere around object
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * INTERACTIONS.HOTSPOT_RADIUS_MULTIPLIER;

    const glowGeom = new THREE.SphereGeometry(radius, CONTROLS_CONFIG.VISUALS.HOTSPOT_GLOW.GEOMETRY_SEGMENTS, CONTROLS_CONFIG.VISUALS.HOTSPOT_GLOW.GEOMETRY_SEGMENTS);
    const glowMat = new THREE.MeshBasicMaterial({
      color: INTERACTIONS.HOTSPOT_GLOW_COLOR,
      transparent: true,
      opacity: INTERACTIONS.HOTSPOT_GLOW_OPACITY,
      depthTest: false,
      side: THREE.BackSide,
    });

    const glowMesh = new THREE.Mesh(glowGeom, glowMat);
    glowMesh.position.copy(box.getCenter(new THREE.Vector3()));

    // Add glow slightly outside the scene
    if (mesh.parent) {
      mesh.parent.add(glowMesh);
    } else {
      scene.add(glowMesh);
    }

    return glowMesh;
  };

  // ========== HELPER: Remove glow effect ==========
  const removeGlowEffect = () => {
    const hotspot = hotspotStateRef.current;
    if (hotspot.glowMesh && hotspot.glowMesh.parent) {
      hotspot.glowMesh.parent.remove(hotspot.glowMesh);
    }
    hotspot.hovered = null;
    hotspot.glowMesh = null;
    gl.domElement.style.cursor = "default";
  };

  // ========== HELPER: Focus on hotspot ==========
  const focusOnHotspot = (obj: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate distance to view object
    const distance = maxDim * 1.5;
    const direction = new THREE.Vector3(1, 0.5, 1).normalize();
    const targetPos = new THREE.Vector3().addVectors(
      center,
      direction.multiplyScalar(distance)
    );

    // Look at object
    const targetQuat = new THREE.Quaternion();
    const lookDir = new THREE.Vector3().subVectors(center, targetPos).normalize();
    targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), lookDir);

    animateCamera(targetPos, targetQuat, INTERACTIONS.DOUBLE_CLICK_DURATION);
  };

  // ========== HELPER: Reset to full room view ==========
  const resetCamera = () => {
    animateCamera(initialCamPosRef.current.clone(), initialCamQuatRef.current.clone(), INTERACTIONS.RESET_DURATION);
  };

  // ========== EVENT: Mouse move (hotspot hover) ==========
  const handleMouseMove = (e: MouseEvent) => {
    const hotspot = getHotspotAtPoint(e.clientX, e.clientY);

    if (hotspot !== hotspotStateRef.current.hovered) {
      removeGlowEffect();

      if (hotspot) {
        hotspotStateRef.current.hovered = hotspot;
        hotspotStateRef.current.glowMesh = createGlowEffect(hotspot);
        gl.domElement.style.cursor = "pointer";
      }
    }
  };

  // ========== EVENT: Mouse down (drag start) ==========
  const handleMouseDown = (e: MouseEvent) => {
    const gesture = gestureStateRef.current;

    if (e.button === 0) { // Left click
      gesture.isDragging = true;
      gesture.dragStart = { x: e.clientX, y: e.clientY };
      gesture.momentumVelocity.set(0, 0, 0);
    }
  };

  // ========== EVENT: Mouse up (drag end, momentum) ==========
  const handleMouseUp = (e: MouseEvent) => {
    const gesture = gestureStateRef.current;

    if (e.button === 0) {
      gesture.isDragging = false;

      // If space is held, apply momentum to rotation
      if (spaceDownRef.current && gesture.momentumVelocity.length() > 0) {
        gesture.isApplyingMomentum = true;
      }
    }
  };

  // ========== EVENT: Double click ==========
  const handleClick = (e: MouseEvent) => {
    const gesture = gestureStateRef.current;
    const now = Date.now();

    if (e.button === 0) { // Left click
      const isDoubleClick = now - gesture.lastClickTime < INTERACTIONS.DOUBLE_CLICK_THRESHOLD;
      gesture.lastClickTime = now;

      if (isDoubleClick) {
        gesture.clickCount = 0; // Reset

        const hotspot = getHotspotAtPoint(e.clientX, e.clientY);
        if (hotspot) {
          focusOnHotspot(hotspot);
        }
      }
    }
  };

  // ========== EVENT: Scroll wheel ==========
  const handleScroll = (e: WheelEvent) => {
    e.preventDefault();

    const gesture = gestureStateRef.current;
    const now = Date.now();

    // Detect double scroll (rapid scroll up)
    if (e.deltaY < 0) { // Scroll up
      const isRapidScroll = now - gesture.lastScrollTime < INTERACTIONS.DOUBLE_SCROLL_THRESHOLD;
      gesture.lastScrollTime = now;
      gesture.scrollCount++;

      if (isRapidScroll && gesture.scrollCount >= 2) {
        gesture.scrollCount = 0;

        // Quick zoom to cursor position
        const hotspot = getHotspotAtPoint(e.clientX, e.clientY);
        if (hotspot) {
          focusOnHotspot(hotspot);
        }
      }
    } else {
      gesture.scrollCount = 0;
    }
  };

  // ========== EVENT: Keyboard ==========
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === " ") {
      spaceDownRef.current = true;
      e.preventDefault();
    }
    if (e.key === "Shift") {
      shiftDownRef.current = true;
    }
    if (e.key === "Escape") {
      removeGlowEffect();
      resetCamera();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") {
      spaceDownRef.current = false;
    }
    if (e.key === "Shift") {
      shiftDownRef.current = false;
    }
  };

  // ========== Setup event listeners ==========
  useEffect(() => {
    const canvas = gl.domElement;

    // Store initial camera state
    initialCamPosRef.current = camera.position.clone();
    initialCamQuatRef.current = camera.quaternion.clone();

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleScroll, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      removeGlowEffect();
    };
  }, [gl, camera, scene, raycaster]);

  // ========== Frame update: Handle animations and momentum ==========
  useFrame(() => {
    const animState = animStateRef.current;
    const gesture = gestureStateRef.current;

    // Handle camera animation
    if (animState.isAnimating) {
      animState.elapsed += 1000 / 60; // Approximate delta time
      const t = Math.min(animState.elapsed / animState.duration, 1);

      // Ease out cubic
      const easeT = 1 - Math.pow(1 - t, 3);

      // Interpolate position
      camera.position.lerpVectors(animState.startPos, animState.targetPos, easeT);

      // Interpolate quaternion (rotation) using slerp
      camera.quaternion.slerpQuaternions(animState.startQuat, animState.targetQuat, easeT);

      if (t >= 1) {
        animState.isAnimating = false;
      }
    }

    // Handle momentum orbit (space + drag)
    if (gesture.isApplyingMomentum && gesture.momentumVelocity.length() > INTERACTIONS.MOMENTUM_MIN_VELOCITY) {
      // Apply rotation using orbit controls equivalent
      // This is simplified - in production, integrate with actual controls
      gesture.momentumVelocity.multiplyScalar(INTERACTIONS.MOMENTUM_FRICTION);
    } else if (gesture.isApplyingMomentum) {
      gesture.isApplyingMomentum = false;
      gesture.momentumVelocity.set(0, 0, 0);
    }
  });

  return null;
}

export default ProfessionalControls;
