/**
 * Blend Shape Controller
 *
 * Controls 3D model facial blend shapes (morph targets) for lip sync animation.
 * Works with Tripo-generated and standard 3D models that have facial rigging.
 */

import * as THREE from "three";
import { VisemeFrame, getVisemeBlendShapes, interpolateVisemes } from "./VisemeSystem";

export interface BlendShapeTarget {
  name: string;
  weight: number; // 0-1
}

export interface BlendShapeState {
  morphTargets: Record<string, number>;
  currentVisemeIndex: number;
  transitionProgress: number;
}

/**
 * Controls blend shapes (morph targets) on a 3D mesh
 * Compatible with Tripo rigged models and standard humanoid rigs
 */
export class BlendShapeController {
  private mesh: THREE.Mesh;
  private morphTargetInfluences: number[];
  private morphTargetDictionary: Record<string, number>;
  private state: BlendShapeState;
  private visemeFrames: VisemeFrame[] = [];
  private currentTime = 0;
  private isPlaying = false;

  constructor(mesh: THREE.Mesh) {
    this.mesh = mesh;
    this.morphTargetInfluences = mesh.morphTargetInfluences || [];
    this.morphTargetDictionary = mesh.morphTargetDictionary || {};

    this.state = {
      morphTargets: {},
      currentVisemeIndex: 0,
      transitionProgress: 0,
    };

    console.log(`✅ Blend Shape Controller initialized`);
    console.log(`   Morph targets available: ${Object.keys(this.morphTargetDictionary).join(", ")}`);
  }

  /**
   * Set viseme sequence for animation
   */
  setVisemeSequence(frames: VisemeFrame[]): void {
    this.visemeFrames = frames;
    this.currentTime = 0;
    this.state.currentVisemeIndex = 0;
    console.log(`📋 Loaded ${frames.length} viseme frames`);
  }

  /**
   * Update blend shapes at current time
   */
  update(deltaTime: number): void {
    if (!this.isPlaying || this.visemeFrames.length === 0) {
      return;
    }

    this.currentTime += deltaTime;

    // Find current viseme frame
    let currentFrame = this.visemeFrames[this.state.currentVisemeIndex];
    let nextFrame = this.visemeFrames[this.state.currentVisemeIndex + 1];

    // Check if we've moved past current frame
    if (this.currentTime > currentFrame.endTime && nextFrame) {
      this.state.currentVisemeIndex++;
      currentFrame = this.visemeFrames[this.state.currentVisemeIndex];
      nextFrame = this.visemeFrames[this.state.currentVisemeIndex + 1];
    }

    if (!currentFrame) {
      this.stop();
      return;
    }

    // Calculate transition progress
    const frameDuration = currentFrame.endTime - currentFrame.startTime;
    const elapsed = this.currentTime - currentFrame.startTime;
    let progress = Math.max(0, Math.min(1, elapsed / frameDuration));

    // Ease out cubic for smooth transitions
    progress = 1 - Math.pow(1 - progress, 3);

    // Get blend shapes for current and next viseme
    const nextViseme = nextFrame ? nextFrame.viseme : currentFrame.viseme;
    const blendShapes = interpolateVisemes(currentFrame.viseme, nextViseme, progress);

    // Apply blend shapes to mesh
    this.applyBlendShapes(blendShapes);

    this.state.transitionProgress = progress;
  }

  /**
   * Apply blend shape weights to mesh
   */
  private applyBlendShapes(blendShapes: Record<string, number>): void {
    Object.entries(blendShapes).forEach(([shapeName, weight]) => {
      const index = this.morphTargetDictionary[shapeName];
      if (index !== undefined && this.morphTargetInfluences[index] !== undefined) {
        // Clamp weight to 0-1
        this.morphTargetInfluences[index] = Math.max(0, Math.min(1, weight));
      }
    });
  }

  /**
   * Manually set specific blend shape weight
   */
  setBlendShape(name: string, weight: number): void {
    const index = this.morphTargetDictionary[name];
    if (index !== undefined) {
      this.morphTargetInfluences[index] = Math.max(0, Math.min(1, weight));
      this.state.morphTargets[name] = weight;
    }
  }

  /**
   * Get all current blend shape weights
   */
  getBlendShapes(): Record<string, number> {
    const result: Record<string, number> = {};
    Object.entries(this.morphTargetDictionary).forEach(([name, index]) => {
      result[name] = this.morphTargetInfluences[index] || 0;
    });
    return result;
  }

  /**
   * Reset all blend shapes to zero
   */
  resetBlendShapes(): void {
    this.morphTargetInfluences.forEach((_, idx) => {
      this.morphTargetInfluences[idx] = 0;
    });
  }

  /**
   * Start animation playback
   */
  play(): void {
    this.isPlaying = true;
    this.currentTime = 0;
    this.state.currentVisemeIndex = 0;
    console.log("▶️ Lip sync animation started");
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.isPlaying = false;
    console.log("⏸️ Lip sync animation paused");
  }

  /**
   * Stop and reset
   */
  stop(): void {
    this.isPlaying = false;
    this.currentTime = 0;
    this.state.currentVisemeIndex = 0;
    this.resetBlendShapes();
    console.log("⏹️ Lip sync animation stopped");
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    this.currentTime = time;
  }

  /**
   * Get current animation time
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Get total animation duration
   */
  getTotalDuration(): number {
    if (this.visemeFrames.length === 0) return 0;
    return this.visemeFrames[this.visemeFrames.length - 1].endTime;
  }

  /**
   * Check if animation is playing
   */
  isAnimationPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get controller state for debugging
   */
  getState(): BlendShapeState {
    return { ...this.state };
  }

  /**
   * List available morphTargets from mesh
   */
  getAvailableMorphTargets(): string[] {
    return Object.keys(this.morphTargetDictionary);
  }
}

/**
 * Multi-mesh blend shape controller
 * Controls blend shapes on multiple meshes (e.g., separate head and jaw meshes)
 */
export class MultiMeshBlendShapeController {
  private controllers: Map<string, BlendShapeController> = new Map();

  constructor(meshMap: Record<string, THREE.Mesh>) {
    Object.entries(meshMap).forEach(([name, mesh]) => {
      this.controllers.set(name, new BlendShapeController(mesh));
    });
  }

  setVisemeSequence(frames: VisemeFrame[]): void {
    this.controllers.forEach((controller) => {
      controller.setVisemeSequence(frames);
    });
  }

  update(deltaTime: number): void {
    this.controllers.forEach((controller) => {
      controller.update(deltaTime);
    });
  }

  play(): void {
    this.controllers.forEach((controller) => {
      controller.play();
    });
  }

  pause(): void {
    this.controllers.forEach((controller) => {
      controller.pause();
    });
  }

  stop(): void {
    this.controllers.forEach((controller) => {
      controller.stop();
    });
  }

  getController(name: string): BlendShapeController | undefined {
    return this.controllers.get(name);
  }
}

export default {
  BlendShapeController,
  MultiMeshBlendShapeController,
};
