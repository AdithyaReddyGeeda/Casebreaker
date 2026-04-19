# Tripo AI 3D Model Generation Workflow

## Overview

This system enables you to dynamically generate 3D models from story descriptions using Tripo AI, then seamlessly integrate them into your CaseBreaker interrogation game.

**Workflow:**
1. Write story descriptions (suspects, rooms, evidence)
2. Generate Tripo prompts automatically
3. Submit to Tripo AI (web or API)
4. Download .glb files
5. Register and load in Three.js scene

---

## 📝 Step 1: Write Story Descriptions

Use the `TripoPromptTemplates.ts` file to structure your story data.

### Example: Describe a Suspect

```typescript
import { SuspectDescription, generateSuspectPrompt } from "@/lib/tripo/TripoPromptTemplates";

const suspect: SuspectDescription = {
  name: "Victoria Harlow",
  age: 34,
  ethnicity: "British",
  gender: "female",
  emotion: "nervous",
  appearance: {
    facialFeatures: "high cheekbones, sharp features",
    expression: "guilt-ridden, avoiding eye contact",
    distinctive: "scar on left temple",
  },
  hairstyle: "dark brown, shoulder-length",
  clothing: "expensive silk blouse, pearl necklace",
};

const tripoPrompt = generateSuspectPrompt(suspect);
console.log(tripoPrompt);
// Output: "Photorealistic 3D human head model. Name: Victoria Harlow..."
```

### Example: Describe a Room

```typescript
import { RoomDescription, generateRoomPrompt } from "@/lib/tripo/TripoPromptTemplates";

const room: RoomDescription = {
  type: "interrogation",
  size: "small",
  style: "modern",
  mood: "tense",
  features: {
    walls: "off-white concrete",
    floor: "grey linoleum",
    lighting: "harsh fluorescent overhead lights",
  },
  furniture: ["steel table", "uncomfortable metal chairs"],
  details: ["coffee stains", "surveillance camera"],
  timeperiod: "modern day",
};

const roomPrompt = generateRoomPrompt(room);
```

### Example: Generate Complete Scenario

```typescript
import { 
  ScenarioDescription, 
  generateCompleteScenarioPrompts,
  EXAMPLE_INTERROGATION_SCENARIO 
} from "@/lib/tripo/TripoPromptTemplates";

// Use the example or create your own
const prompts = generateCompleteScenarioPrompts(EXAMPLE_INTERROGATION_SCENARIO);

console.log("Suspect prompts:", prompts.suspects);
console.log("Room prompt:", prompts.room);
console.log("Evidence prompts:", prompts.evidence);
```

---

## 🤖 Step 2: Generate Tripo Prompts

The system automatically converts story descriptions into optimized Tripo AI prompts.

### Export for Batch Processing

```typescript
import { exportPromptsAsJson } from "@/lib/tripo/TripoPromptTemplates";

const exported = exportPromptsAsJson(EXAMPLE_INTERROGATION_SCENARIO);

// Save to JSON for reference
console.log(JSON.stringify(exported, null, 2));

// Or export for your workflow
// exported.suspects[0].prompt → Copy to Tripo web interface
// exported.room.prompt → Copy to Tripo web interface
// exported.evidence[0].prompt → Copy to Tripo web interface
```

---

## 🎨 Step 3: Generate Models with Tripo AI

### Option A: Web Interface (Manual)

1. Go to [https://www.tripo3d.ai](https://www.tripo3d.ai)
2. Sign up (free tier available)
3. For each prompt:
   - Click "Generate from Text"
   - Paste prompt from `exportPromptsAsJson()`
   - Wait ~2-10 seconds for generation
   - Download as `.glb` (GLB/GLTF format)

### Option B: Tripo API (Automated)

```typescript
// Example API call (requires API key from Tripo dashboard)
async function generateWithTripoAPI(prompt: string, apiKey: string) {
  const response = await fetch("https://api.tripo3d.ai/v1/models", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt,
      format: "glb", // Downloads as .glb
    }),
  });

  const result = await response.json();
  return result.modelUrl; // Download URL for the generated .glb
}
```

---

## 💾 Step 4: Store Generated Models

### Create `/public/models/` Structure

```
public/
├── models/
│   ├── suspects/
│   │   ├── victoria-harlow.glb
│   │   ├── oliver-crane.glb
│   │   └── fenn-harwick.glb
│   ├── rooms/
│   │   ├── interrogation-room-1.glb
│   │   └── interrogation-room-2.glb
│   └── evidence/
│       ├── murder-weapon.glb
│       ├── love-letter.glb
│       └── photo-evidence.glb
```

**Important:** Place all `.glb` files in `/public/models/` so they're accessible at `/models/filename.glb`

---

## 📦 Step 5: Register Models in Your Game

### Register Models Once (at game startup)

```typescript
import { registerTripoModels } from "@/game/components/interrogation/TripoModelLoader";

// In your game initialization
const gameAssets = [
  // Suspects
  {
    id: "suspect-victoria",
    name: "Victoria Harlow",
    type: "suspect" as const,
    url: "/models/suspects/victoria-harlow.glb",
  },
  {
    id: "suspect-oliver",
    name: "Oliver Crane",
    type: "suspect" as const,
    url: "/models/suspects/oliver-crane.glb",
  },
  // Room
  {
    id: "room-interrogation-1",
    name: "Interrogation Room",
    type: "room" as const,
    url: "/models/rooms/interrogation-room-1.glb",
  },
  // Evidence
  {
    id: "evidence-weapon",
    name: "Murder Weapon",
    type: "evidence" as const,
    url: "/models/evidence/murder-weapon.glb",
  },
];

await registerTripoModels(gameAssets);
```

---

## 🎮 Step 6: Load Models in Three.js Scene

### Option A: Load Single Model

```typescript
import { useTripoModel } from "@/game/lib/tripo/useTripoModel";

function SuspectView() {
  const { scene, isLoading, error } = useTripoModel(
    "suspect-victoria",
    {
      scale: 27, // Scale to room proportions
      position: [-5, 95, 20], // On the chair
      onLoad: (group) => {
        console.log("Suspect loaded!");
      },
    }
  );

  if (isLoading) return <div>Loading suspect...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <primitive object={scene} />;
}
```

### Option B: Load Complete Scene (Recommended)

```typescript
import { TripoSceneSetup } from "@/game/components/interrogation/TripoModelLoader";

function InterrogationScene() {
  return (
    <TripoSceneSetup
      room={{
        id: "room-interrogation-1",
        scale: 1,
        position: [0, 0, 0],
      }}
      suspects={[
        {
          id: "suspect-victoria",
          scale: 27,
          position: [-5, 95, 20],
        },
      ]}
      evidence={[
        {
          id: "evidence-weapon",
          scale: 50,
          position: [0, 75, 10],
        },
      ]}
      onAllLoaded={() => console.log("Scene ready!")}
      onError={(error) => console.error("Failed to load:", error)}
    />
  );
}
```

### Option C: Use React Component

```tsx
import TripoModelLoader from "@/game/components/interrogation/TripoModelLoader";

function GameScene() {
  return (
    <Canvas>
      <ProfessionalControls />
      
      {/* Load room */}
      <TripoModelLoader
        modelId="room-interrogation-1"
        modelType="room"
        scale={1}
        position={[0, 0, 0]}
      />

      {/* Load suspect */}
      <TripoModelLoader
        modelId="suspect-victoria"
        modelType="suspect"
        scale={27}
        position={[-5, 95, 20]}
        onLoad={(group) => console.log("Suspect ready")}
      />

      {/* Load evidence */}
      <TripoModelLoader
        modelId="evidence-weapon"
        modelType="evidence"
        scale={50}
        position={[0, 75, 10]}
      />

      <OrbitControls />
    </Canvas>
  );
}
```

---

## 🎯 Workflow Example: Complete Game Case

```typescript
import { 
  ScenarioDescription, 
  generateCompleteScenarioPrompts,
  exportPromptsAsJson 
} from "@/lib/tripo/TripoPromptTemplates";

// 1. Define your game case
const gameCaseDefinition: ScenarioDescription = {
  title: "The Garden Party Murder",
  suspects: [
    {
      name: "Victoria Harlow",
      age: 34,
      gender: "female",
      emotion: "nervous",
      appearance: { facialFeatures: "high cheekbones" },
    },
    // ... more suspects
  ],
  room: {
    type: "interrogation",
    style: "modern",
    mood: "tense",
    furniture: ["steel table", "chairs"],
  },
  evidence: [
    {
      name: "Murder Weapon",
      type: "weapon",
      condition: "bloodstained",
    },
  ],
};

// 2. Generate Tripo prompts
const prompts = generateCompleteScenarioPrompts(gameCaseDefinition);
const exported = exportPromptsAsJson(gameCaseDefinition);

// 3. Use prompts in Tripo AI to generate .glb files

// 4. Save .glb files to /public/models/

// 5. Register models
await registerTripoModels([
  { id: "suspect-victoria", name: "Victoria", type: "suspect", url: "/models/victoria.glb" },
  // ... etc
]);

// 6. Load in scene
function CaseScene() {
  return (
    <TripoSceneSetup
      suspects={[{ id: "suspect-victoria" }]}
      room={{ id: "room-1" }}
      evidence={[{ id: "evidence-weapon" }]}
    />
  );
}
```

---

## 📊 Model Properties & Scaling

### Typical Scaling Factors

| Model Type | Suggested Scale | Reason |
|---|---|---|
| Suspect head | 20-30× | ~2.7 unit head needs to fit in ~350-unit room |
| Room | 1× | Already room-sized from Tripo |
| Evidence items | 5-50× | Depends on object size |

### Positioning Suspects

```typescript
// Based on room bounds from diagnostics:
// Room dimensions: 347.58 x 276.92 x 637.01
// Floor at Y: 0, Seated eye height: ~80-100

const suspectPositions = {
  chair1_facing_camera: [-5, 95, 20],  // Left chair, center-ish
  chair2_facing_camera: [5, 95, 20],   // Right chair, center-ish
  sitting_back: [-5, 95, -100],        // Far side of table
};
```

---

## 🚀 Performance Optimization

### Model Caching

Models are cached automatically after first load:

```typescript
import { useTripoModel } from "@/lib/tripo/useTripoModel";

// First load downloads from disk
const { scene } = useTripoModel("suspect-victoria");

// Subsequent loads use cache instantly
const { scene: cached } = useTripoModel("suspect-victoria");
```

### Batch Loading

```typescript
import { useTripoModels } from "@/lib/tripo/useTripoModel";

const { scenes, isLoading } = useTripoModels([
  "suspect-victoria",
  "suspect-oliver",
  "room-1",
  "evidence-weapon",
]);
```

### Clear Cache (if needed)

```typescript
import TripoModelManager from "@/lib/tripo/TripoModelManager";

const manager = TripoModelManager.getInstance();
manager.clearCache(); // Remove all cached models from memory
```

---

## 🐛 Troubleshooting

### Model Not Loading
- ✅ Check `/public/models/` path is correct
- ✅ Verify `.glb` file exists and is valid
- ✅ Check browser console for loading errors

### Wrong Scale/Position
- ✅ Use diagnostic to check room bounds
- ✅ Scale suspect head 20-30×
- ✅ Position based on chair location in room

### Performance Issues
- ✅ Enable glow effects only when needed
- ✅ Use LOD (Level of Detail) for distant models
- ✅ Cache models after loading

---

## 📚 API Reference

### TripoPromptTemplates

- `generateSuspectPrompt(suspect)` → Tripo prompt string
- `generateRoomPrompt(room)` → Tripo prompt string
- `generateEvidencePrompt(evidence)` → Tripo prompt string
- `generateCompleteScenarioPrompts(scenario)` → All prompts object
- `exportPromptsAsJson(scenario)` → JSON for export/batch

### TripoModelManager

- `registerModel(model)` → Register a model
- `loadModel(modelId)` → Load and return THREE.Group
- `getModel(modelId)` → Get registered model info
- `listModels(type)` → List all or filtered models
- `scaleModel(scene, factor)` → Apply scale
- `positionModel(scene, xyz)` → Apply position
- `getModelBounds(scene)` → Get width/height/depth

### Hooks

- `useTripoModel(modelId, options)` → Load single model
- `useTripoModels(modelIds, options)` → Load multiple models
- `useTripoModelRegistry()` → Manage registration

### Components

- `<TripoModelLoader />` → Load single model in scene
- `<TripoSceneSetup />` → Load complete scene setup
- `<registerTripoModels(models) />` → Register models

---

## 🎬 Next Steps

1. ✅ Create story descriptions for your game cases
2. ✅ Generate Tripo prompts from descriptions
3. ✅ Generate 3D models using Tripo AI
4. ✅ Download and save to `/public/models/`
5. ✅ Register models with `registerTripoModels()`
6. ✅ Load in scene with `<TripoSceneSetup />`
7. ✅ Test with ProfessionalControls

**You now have a complete workflow for generating dynamic 3D game assets!** 🎮

---

**Version**: 1.0
**Last Updated**: 2026-04-19
**Status**: Production Ready ✅
