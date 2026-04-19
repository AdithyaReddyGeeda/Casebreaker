/**
 * Lip Sync Controller Component
 *
 * React Three Fiber component that orchestrates audio playback,
 * phoneme analysis, and facial animation for real-time lip sync.
 *
 * Usage:
 * <LipSyncController
 *   suspectModel={modelGroup}
 *   audioUrl="/audio/suspect-confession.mp3"
 *   analyzerMode="deepgram"
 *   apiKey={process.env.DEEPGRAM_API_KEY}
 * />
 */

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BlendShapeController } from "@/lib/lipsync/BlendShapeController";
import { AudioAnalyzerManager } from "@/lib/lipsync/AudioAnalyzer";
import { VisemeFrame } from "@/lib/lipsync/VisemeSystem";

export interface LipSyncControllerProps {
  /** 3D model group with facial blend shapes */
  suspectModel: THREE.Group;

  /** Audio URL or AudioBuffer */
  audioUrl?: string;
  audioBuffer?: AudioBuffer;

  /** Analyzer mode: deepgram, whisper, or webspeech */
  analyzerMode?: "deepgram" | "whisper" | "webspeech";

  /** API key for cloud analyzers */
  apiKey?: string;

  /** Callback when analysis completes */
  onAnalysisComplete?: (duration: number) => void;

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Auto-start playback when ready */
  autoPlay?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Main Lip Sync Controller
 */
export function LipSyncController({
  suspectModel,
  audioUrl,
  audioBuffer,
  analyzerMode = "webspeech",
  apiKey,
  onAnalysisComplete,
  onError,
  autoPlay = false,
  debug = false,
}: LipSyncControllerProps) {
  const { scene } = useThree();

  const controllerRef = useRef<BlendShapeController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<AudioAnalyzerManager | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [visemeFrames, setVisemeFrames] = useState<VisemeFrame[]>([]);

  // ========== Initialize Blend Shape Controller ==========
  useEffect(() => {
    if (!suspectModel) return;

    // Find mesh with morph targets
    let targetMesh: THREE.Mesh | null = null;
    suspectModel.traverse((child) => {
      if ("isMesh" in child && child.isMesh && (child as THREE.Mesh).morphTargetInfluences) {
        targetMesh = child as THREE.Mesh;
      }
    });

    if (targetMesh) {
      controllerRef.current = new BlendShapeController(targetMesh);
      if (debug) {
        console.log("✅ Blend shape controller ready");
        console.log(
          "   Available morphs:",
          controllerRef.current.getAvailableMorphTargets()
        );
      }
    } else {
      console.warn(
        "⚠️ No mesh with morph targets found. Ensure Tripo model is rigged."
      );
    }
  }, [suspectModel, debug]);

  // ========== Initialize Audio Analyzer ==========
  useEffect(() => {
    if (analyzerMode === "webspeech" || apiKey) {
      try {
        analyzerRef.current = new AudioAnalyzerManager(analyzerMode, apiKey);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        if (debug) console.error("❌ Analyzer initialization failed:", err);
      }
    }
  }, [analyzerMode, apiKey, debug, onError]);

  // ========== Load Audio and Analyze ==========
  useEffect(() => {
    if (!audioUrl && !audioBuffer) return;

    const loadAndAnalyze = async () => {
      setIsLoading(true);

      try {
        // Load audio
        let audio: AudioBuffer | Blob;

        if (audioBuffer) {
          audio = audioBuffer;
        } else if (audioUrl) {
          const response = await fetch(audioUrl);
          audio = await response.blob();
        } else {
          throw new Error("No audio provided");
        }

        if (debug) console.log("🎵 Audio loaded, analyzing...");

        // Analyze for visemes
        if (!analyzerRef.current) {
          throw new Error("Analyzer not initialized");
        }

        const result = await analyzerRef.current.analyze(audio);

        if (debug) {
          console.log("✨ Analysis complete:");
          console.log("   Text:", result.text);
          console.log("   Confidence:", (result.confidence * 100).toFixed(1) + "%");
          console.log("   Viseme frames:", result.visemeFrames.length);
        }

        setVisemeFrames(result.visemeFrames);

        // Set up audio element
        if (typeof audioUrl === "string") {
          if (!audioRef.current) {
            audioRef.current = new Audio();
          }
          audioRef.current.src = audioUrl;
          audioRef.current.addEventListener("ended", () => setIsPlaying(false));

          audioRef.current.onloadedmetadata = () => {
            setDuration(audioRef.current!.duration);
            if (debug) console.log("⏱️ Duration:", audioRef.current!.duration.toFixed(2) + "s");
          };
        } else if (audioBuffer) {
          setDuration(audioBuffer.duration);
        }

        // Set viseme sequence
        if (controllerRef.current) {
          controllerRef.current.setVisemeSequence(result.visemeFrames);
        }

        onAnalysisComplete?.(duration);

        if (autoPlay && audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
          if (controllerRef.current) {
            controllerRef.current.play();
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        if (debug) console.error("❌ Analysis failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAndAnalyze();
    return () => {
      audioRef.current?.pause();
    };
  }, [
    audioUrl,
    audioBuffer,
    autoPlay,
    debug,
    onAnalysisComplete,
    onError,
  ]);

  // ========== Animation Loop ==========
  useFrame((state, delta) => {
    if (!controllerRef.current || !isPlaying) return;

    // Update current time
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      controllerRef.current.seek(audioRef.current.currentTime);
    }

    // Update blend shapes
    controllerRef.current.update(delta);
  });

  // ========== Controls ==========
  const play = () => {
    if (audioRef.current && controllerRef.current) {
      audioRef.current.play();
      controllerRef.current.play();
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current && controllerRef.current) {
      audioRef.current.pause();
      controllerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stop = () => {
    if (audioRef.current && controllerRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      controllerRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current && controllerRef.current) {
      audioRef.current.currentTime = time;
      controllerRef.current.seek(time);
      setCurrentTime(time);
    }
  };

  // Expose controls via window for debugging
  useEffect(() => {
    if (debug && typeof window !== "undefined") {
      (window as any).lipSyncDebug = {
        play,
        pause,
        stop,
        seek,
        getTime: () => currentTime,
        getDuration: () => duration,
        getVisemeFrames: () => visemeFrames,
      };
    }
  }, [debug, currentTime, duration, visemeFrames]);

  return (
    <group>
      {/* Hidden audio element for playback */}
      {audioUrl && <audio ref={audioRef} crossOrigin="anonymous" />}

      {/* UI Controls */}
      {visemeFrames.length > 0 && (
        <LipSyncUI
          isPlaying={isPlaying}
          isLoading={isLoading}
          currentTime={currentTime}
          duration={duration}
          visemeCount={visemeFrames.length}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onSeek={seek}
        />
      )}
    </group>
  );
}

/**
 * UI Component for Lip Sync Controls
 */
interface LipSyncUIProps {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  visemeCount: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
}

function LipSyncUI({
  isPlaying,
  isLoading,
  currentTime,
  duration,
  visemeCount,
  onPlay,
  onPause,
  onStop,
  onSeek,
}: LipSyncUIProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={{ margin: 0 }}>🎬 Lip Sync</h3>
        <span style={styles.status}>
          {isLoading ? "⏳ Analyzing..." : `✓ ${visemeCount} visemes`}
        </span>
      </div>

      {/* Timeline */}
      <div style={styles.timeline}>
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          style={styles.slider}
          disabled={duration === 0}
        />
        <span style={styles.time}>
          {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button
          onClick={onStop}
          style={{ ...styles.button, opacity: duration === 0 ? 0.5 : 1 }}
          disabled={duration === 0}
        >
          ⏹️ Stop
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          style={{ ...styles.button, opacity: duration === 0 ? 0.5 : 1 }}
          disabled={duration === 0}
        >
          {isPlaying ? "⏸️ Pause" : "▶️ Play"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed" as const,
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    color: "#fff",
    padding: "15px",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "12px",
    maxWidth: "300px",
    zIndex: 1000,
  },
  header: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: "10px",
    fontSize: "14px",
    fontWeight: "bold" as const,
  },
  status: {
    color: "#ffd700",
    fontSize: "12px",
  },
  timeline: {
    marginBottom: "10px",
  },
  slider: {
    width: "100%",
    marginBottom: "5px",
    cursor: "pointer" as const,
  },
  time: {
    display: "block" as const,
    textAlign: "center" as const,
    fontSize: "11px",
    color: "#aaa",
  },
  controls: {
    display: "flex" as const,
    gap: "8px",
  },
  button: {
    flex: 1,
    padding: "8px",
    backgroundColor: "#ffd700",
    color: "#000",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer" as const,
    fontWeight: "bold" as const,
    fontSize: "12px",
  },
};

export default LipSyncController;
