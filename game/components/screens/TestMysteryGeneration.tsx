/**
 * Test Mystery Generation Screen
 *
 * Use this to test the automated workflow with placeholder data
 * Just click "Generate" and watch the magic happen
 *
 * Usage: Go to /test-mystery in your app to see this screen
 */

"use client";

import { useState } from "react";
import { useMysteryAssets } from "@/lib/mystery/useMysteryAssets";
import type { GeneratedMystery } from "@/lib/mystery/MysteryToGameAssetsService";

/**
 * Placeholder mystery data for testing
 */
const PLACEHOLDER_MYSTERY: GeneratedMystery = {
  caseId: "test-case-001",
  title: "The Test Murder Mystery",
  description: "A mysterious test case to verify the automated workflow",

  suspects: [
    {
      name: "Victoria Harlow",
      age: 34,
      gender: "female",
      ethnicity: "British",
      emotion: "nervous",
      appearance: {
        facialFeatures: "high cheekbones, sharp features, pale skin",
        expression: "guilt-ridden, avoiding eye contact",
        scars: "small scar on left temple",
        distinctive: "elegant appearance, pearl necklace",
      },
      hairstyle: "dark brown, shoulder-length",
      clothing: "expensive silk blouse, designer suit",
    },
    {
      name: "Oliver Crane",
      age: 42,
      gender: "male",
      emotion: "angry",
      appearance: {
        facialFeatures: "strong jaw, intense dark eyes, salt and pepper hair",
        expression: "defensive, clenched jaw, suspicious",
        distinctive: "tall, commanding presence",
      },
      hairstyle: "salt-and-pepper, slicked back",
      clothing: "tailored suit, loose tie",
    },
    {
      name: "Fenn Harwick",
      age: 28,
      gender: "male",
      emotion: "calm",
      appearance: {
        facialFeatures: "boyish features, blonde hair, blue eyes",
        expression: "composed, confident",
        distinctive: "athletic build",
      },
      hairstyle: "blonde, tousled",
      clothing: "casual designer clothes, expensive watch",
    },
  ],

  room: {
    type: "interrogation",
    size: "small",
    style: "modern",
    mood: "tense",
    features: {
      walls: "off-white concrete with water stains",
      floor: "grey linoleum, scuffed",
      ceiling: "drop tile with exposed wiring",
      lighting: "harsh fluorescent overhead lights",
      windows: "none, just a two-way mirror",
    },
    furniture: ["steel interrogation table", "uncomfortable metal chairs", "filing cabinet"],
    details: ["coffee stains on table", "surveillance camera in corner", "clock on wall", "worn paint"],
    timeperiod: "modern day",
  },

  evidence: [
    {
      name: "Murder Weapon",
      type: "weapon",
      color: "silver and gold",
      material: "ornate letter opener",
      condition: "bloodstained",
      detail: "engraved with victim's initials",
    },
    {
      name: "Love Letter",
      type: "document",
      color: "cream",
      material: "expensive paper",
      condition: "worn",
      detail: "handwritten confession of affair",
    },
    {
      name: "Hotel Receipt",
      type: "document",
      color: "white",
      material: "paper",
      condition: "pristine",
      detail: "shows alibi contradiction",
    },
  ],

  metadata: {
    difficulty: "medium",
    timeLimit: 300,
    hiddenClues: ["watch was stopped at 8:15", "lipstick on cigarette butt"],
  },
};

export default function TestMysteryGeneration() {
  const { assets, isLoading, error, progress, generate, reset } = useMysteryAssets();
  const [showResults, setShowResults] = useState(false);

  const handleGenerateClick = async () => {
    try {
      await generate(PLACEHOLDER_MYSTERY);
      setShowResults(true);
    } catch (err) {
      console.error("Generation failed:", err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🧪 Test Mystery Generation</h1>
        <p>Testing the automated workflow with placeholder data</p>
      </div>

      {/* Status Panel */}
      <div style={styles.statusPanel}>
        <h2>Status</h2>

        {!assets && !isLoading && !error && (
          <div>
            <p style={styles.idle}>Ready to generate</p>
            <button onClick={handleGenerateClick} style={styles.button}>
              🚀 Generate Mystery Assets
            </button>
          </div>
        )}

        {isLoading && (
          <div>
            <p style={styles.loading}>⏳ {progress}</p>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: progress.includes("Tripo") ? "33%" : progress.includes("ElevenLabs") ? "66%" : "99%",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div>
            <p style={styles.error}>❌ Error: {error.message}</p>
            <button onClick={reset} style={styles.button}>
              🔄 Reset & Try Again
            </button>
          </div>
        )}

        {assets && !isLoading && (
          <div>
            <p style={styles.success}>✅ Generation Complete!</p>
            <button onClick={() => setShowResults(!showResults)} style={styles.button}>
              {showResults ? "🙈 Hide Results" : "👁️ Show Results"}
            </button>
            <button onClick={reset} style={{ ...styles.button, marginLeft: "10px" }}>
              🔄 Generate Again
            </button>
          </div>
        )}
      </div>

      {/* Results Panel */}
      {showResults && assets && (
        <div style={styles.resultsPanel}>
          <h2>📊 Generated Assets</h2>

          <div style={styles.section}>
            <h3>Case Info</h3>
            <p>
              <strong>ID:</strong> {assets.caseId}
            </p>
            <p>
              <strong>Title:</strong> {assets.title}
            </p>
            <p>
              <strong>Generated:</strong> {new Date(assets.generatedAt).toLocaleString()}
            </p>
          </div>

          <div style={styles.section}>
            <h3>🕵️ Suspects ({assets.suspects.length})</h3>
            {assets.suspects.map((suspect) => (
              <div key={suspect.id} style={styles.card}>
                <h4>{suspect.originalData.name}</h4>
                <p>
                  <strong>Model ID:</strong> <code>{suspect.modelId}</code>
                </p>
                <p>
                  <strong>Audio:</strong>{" "}
                  {suspect.audioUrl ? (
                    <>
                      <audio controls style={styles.audio}>
                        <source src={suspect.audioUrl} type="audio/mpeg" />
                        Your browser does not support audio playback
                      </audio>
                      <span style={styles.checkmark}>✓ Generated</span>
                    </>
                  ) : (
                    <span style={styles.error}>❌ Failed</span>
                  )}
                </p>
                <p>
                  <strong>Lip Sync Frames:</strong> {suspect.visemeFrames.length} frames
                  {suspect.visemeFrames.length > 0 && <span style={styles.checkmark}> ✓</span>}
                </p>
              </div>
            ))}
          </div>

          <div style={styles.section}>
            <h3>🏢 Room</h3>
            <div style={styles.card}>
              <p>
                <strong>Model ID:</strong> <code>{assets.room.id}</code>
              </p>
              <p>
                <strong>Type:</strong> {assets.room.originalData.type}
              </p>
            </div>
          </div>

          <div style={styles.section}>
            <h3>🔍 Evidence ({assets.evidence.length})</h3>
            {assets.evidence.map((item) => (
              <div key={item.id} style={styles.card}>
                <p>
                  <strong>{item.originalData.name}</strong> ({item.originalData.type})
                </p>
              </div>
            ))}
          </div>

          <div style={styles.section}>
            <h3>🎬 Next Steps</h3>
            <ol>
              <li>Models are registered in the system</li>
              <li>Audio files are generated and ready</li>
              <li>Lip sync data is analyzed</li>
              <li>Ready to use in InterrogationScene!</li>
            </ol>
            <p style={styles.tip}>
              💡 Now you can go to the Interrogation Room and interrogate these suspects with
              auto-generated models, voices, and lip sync!
            </p>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div style={styles.debugPanel}>
        <h3>🔧 Debug Info</h3>
        <p>
          <strong>Loading:</strong> {isLoading ? "Yes" : "No"}
        </p>
        <p>
          <strong>Assets Generated:</strong> {assets ? "Yes" : "No"}
        </p>
        <p>
          <strong>Error:</strong> {error ? error.message : "None"}
        </p>
        <p style={styles.hint}>
          ℹ️ Check browser console (F12) for detailed logs of the generation process
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "30px 20px",
    fontFamily: "monospace",
    backgroundColor: "#0a0a0a",
    color: "#c8d0dc",
    minHeight: "100vh",
  },
  header: {
    marginBottom: "40px",
    borderBottom: "2px solid #ffd700",
    paddingBottom: "20px",
  },
  statusPanel: {
    backgroundColor: "rgba(255, 215, 0, 0.05)",
    border: "1px solid rgba(255, 215, 0, 0.2)",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "30px",
  },
  resultsPanel: {
    backgroundColor: "rgba(100, 200, 100, 0.05)",
    border: "1px solid rgba(100, 200, 100, 0.2)",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "30px",
  },
  debugPanel: {
    backgroundColor: "rgba(100, 150, 200, 0.05)",
    border: "1px solid rgba(100, 150, 200, 0.2)",
    borderRadius: "8px",
    padding: "15px",
    marginTop: "20px",
    fontSize: "12px",
  },
  section: {
    marginBottom: "20px",
    paddingBottom: "15px",
    borderBottom: "1px solid rgba(200, 208, 220, 0.1)",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(200, 208, 220, 0.1)",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "10px",
  },
  button: {
    backgroundColor: "#ffd700",
    color: "#000",
    padding: "10px 15px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold" as const,
    fontSize: "14px",
    marginRight: "10px",
    marginBottom: "10px",
  },
  progressBar: {
    width: "100%",
    height: "20px",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: "4px",
    overflow: "hidden",
    marginTop: "10px",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ffd700",
    transition: "width 0.3s ease",
  },
  idle: {
    color: "#aaa",
  },
  loading: {
    color: "#ffd700",
    fontSize: "16px",
  },
  success: {
    color: "#64c864",
    fontSize: "16px",
  },
  error: {
    color: "#ff6b6b",
  },
  checkmark: {
    color: "#64c864",
    marginLeft: "10px",
  },
  audio: {
    marginRight: "10px",
    height: "20px",
  },
  tip: {
    color: "#ffd700",
    fontStyle: "italic" as const,
    marginTop: "10px",
  },
  hint: {
    color: "#667788",
    fontSize: "12px",
  },
};
