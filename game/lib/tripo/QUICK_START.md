# Tripo Workflow - Quick Start Guide

## 1️⃣ Describe Your Case

```typescript
import { ScenarioDescription } from "@/lib/tripo/TripoPromptTemplates";

const myCaseDefinition: ScenarioDescription = {
  title: "Case Name",
  suspects: [
    {
      name: "John Doe",
      age: 45,
      gender: "male",
      emotion: "angry",
      appearance: {
        facialFeatures: "strong jaw, beard",
        expression: "suspicious, cold",
      },
    }
  ],
  room: {
    type: "interrogation",
    size: "small",
    style: "modern",
    mood: "tense",
    furniture: ["table", "chairs", "camera"],
  },
  evidence: [
    {
      name: "Gun",
      type: "weapon",
      condition: "bloodstained",
    }
  ],
};
```

## 2️⃣ Generate Prompts

```typescript
import { generateCompleteScenarioPrompts } from "@/lib/tripo/TripoPromptTemplates";

const prompts = generateCompleteScenarioPrompts(myCaseDefinition);

// Use these prompts in Tripo AI ↓
console.log(prompts.suspects);     // Copy to Tripo web interface
console.log(prompts.room);
console.log(prompts.evidence);
```

## 3️⃣ Generate Models in Tripo

1. Go to [https://www.tripo3d.ai](https://www.tripo3d.ai)
2. Paste prompt from step 2
3. Wait for generation (~2-10 seconds)
4. **Download as `.glb`** (important!)
5. Repeat for each model

## 4️⃣ Save Files

```
public/models/
├── suspects/
│   └── john-doe.glb
├── rooms/
│   └── interrogation-room.glb
└── evidence/
    └── gun.glb
```

## 5️⃣ Register Models

```typescript
import { registerTripoModels } from "@/game/components/interrogation/TripoModelLoader";

await registerTripoModels([
  { 
    id: "suspect-john",
    name: "John Doe",
    type: "suspect",
    url: "/models/suspects/john-doe.glb"
  },
  { 
    id: "room-1",
    name: "Interrogation Room",
    type: "room",
    url: "/models/rooms/interrogation-room.glb"
  },
  { 
    id: "evidence-gun",
    name: "Gun",
    type: "evidence",
    url: "/models/evidence/gun.glb"
  },
]);
```

## 6️⃣ Load in Scene

```tsx
import { TripoSceneSetup } from "@/game/components/interrogation/TripoModelLoader";

function MyGameScene() {
  return (
    <Canvas>
      <TripoSceneSetup
        room={{ id: "room-1" }}
        suspects={[{ id: "suspect-john", scale: 27, position: [-5, 95, 20] }]}
        evidence={[{ id: "evidence-gun", scale: 50, position: [0, 75, 10] }]}
      />
      <ProfessionalControls />
    </Canvas>
  );
}
```

## ✅ Done!

Your Tripo-generated 3D models are now in your game with full professional controls!

---

### 🎯 Key Scaling Tips

- **Suspect head**: 20-30× (room is ~350 units wide, head is ~2.7 units)
- **Room**: 1× (already room-sized)
- **Evidence**: 5-50× (depends on object)
- **Seated height**: Y position ~80-100

### 📖 Full Docs

See `TRIPO_WORKFLOW.md` for complete documentation
