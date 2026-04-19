# Investigation engine architecture

This document describes how the Casebreaker “Vidya” game separates **deterministic game logic** from **LLM-generated dialogue**. The product is not implemented as prompt-only engineering: outcomes, progression eligibility, scoring-relevant state, and verdict correctness are defined in code and static case data.

---

## Canonical case truth

Ground truth lives in structured data, not in model outputs.

- **`lib/cases/harlow-manor.ts`** — Shipped `Case`: suspects, evidence, rooms, `killerId`, verdict copy (explanation, sequence, missed clues).
- **`lib/investigationCanonical.ts`** — `CanonicalCaseFacts`: `killerId`, per-evidence `evidenceTruth` (who each item implicates, red-herring flags), timeline, solution strings.

`buildCanonicalCaseFacts` derives the canonical model from the case file so interrogation, contradiction checks, and verdict narrative pull from one consistent source. LLM prompts may *reflect* this world for flavor; they do **not** define who is guilty or what evidence means for scoring.

---

## Session state

- **Client session**: `sessionId`, `sessionStartedAt`, `caseId` — set when the player enters the run (first transition to cinematic). Optional **`backendSessionToken`** when `NEXT_PUBLIC_CASEBREAKER_API_URL` succeeds (FastAPI session for adapter wiring).
- **Persistence**: Zustand store (`lib/store.ts`); no reliance on the model to remember facts across turns.

Session identifiers correlate analytics and optional remote APIs; they do not override canonical truth.

---

## Interrogation state transitions

- **Per-suspect transcript**: `interrogationHistories[suspectId]` — user/assistant messages.
- **Stress**: `suspectStress` and mirrored `suspectStates[suspectId].stress` — updated by keyword-based stress impact from the user’s question (server-side rules in `interrogationStressRules.ts`) and by the contradiction engine after each turn.
- **Transport**: `interrogateSuspect` (`investigationService.ts`) delegates to `InvestigationEngine` — local Next `/api/interrogate` (SSE) or FastAPI when runtime config + token allow (`localInvestigationEngine.ts`, `backendInvestigationEngine.ts`).

Transitions are **event-driven** (message sent → stream → `recordInterrogationTurnOutcome`); the LLM does not gate navigation between screens.

---

## Contradiction tracking

- **`contradictionHistory`**: append-only list of `ContradictionEvent` objects (`lib/investigation/types.ts`).
- **Engine**: `runInterrogationContradictionEngine` (`contradictionEngine.ts`) — deterministic rules:
  - User questions that reference **discovered** evidence which **canonically implicates** the active suspect → “canonical press” events (topic patterns on the user message).
  - Heuristic comparison of the **latest assistant reply** vs **examined** evidence + canonical facts (model text is a cue; adjudication uses file truth).

Stress can increase when new contradictions are recorded (`stressDeltaForNewContradictions`). The model is not asked to “emit a contradiction”; the engine decides.

---

## Evidence-driven reasoning

- **Discovered evidence**: IDs collected via room search / discovery (`discoveredEvidence`).
- **Examined evidence**: IDs from formal examination (`examinedEvidenceIds`, `registerEvidenceExamination`) — drives unlock of canonical fact keys (`unlockedCanonicalFactIds`) via `evidenceExamination.ts`.

Contradiction and unlock logic use **IDs + `CanonicalCaseFacts.evidenceTruth`**, not free-form model summaries.

---

## Accusation / verdict pipeline

1. **Submit**: `submitAccusation` (store) calls `executeAccusationSubmission` (`accusationSubmission.ts`) with suspect, reasoning, discovered/examined IDs, contradiction history, `canonicalKillerId`, session metadata.
2. **Outcome**: `buildVerdictResultFromCanonicalTruth` — `correct := (accusedId === canonicalKillerId)`. Player reasoning is stored for display only.
3. **Resolved verdict**: `buildResolvedVerdictFromCanonicalInputs` → `getVerdict` (`investigationService.ts`) — missed non–red-herring evidence names, solution copy, adjudication snapshot (discovered / examined / contradiction IDs + counts). `narrativeSource: "canonical_case_file"`.

The UI reads `resolvedVerdict` for the verdict screen; narrative strings come from the case file, not from an LLM verdict call.

---

## LLM vs deterministic logic

| Concern | Mechanism |
|--------|-----------|
| In-character replies | LLM (Claude via `/api/interrogate`, or FastAPI interrogation when configured) |
| Stress from question keywords | Deterministic (`interrogationStressRules.ts`) |
| Who killed whom / correct accusation | `canonicalKillerId` vs `suspectId` |
| Contradiction events | `contradictionEngine.ts` + store history |
| Evidence implications | `evidenceTruth` / case file |
| Verdict copy & missed evidence list | Static case data via `getVerdict` |
| TTS | `/api/speak` (providers behind route); not used for truth |

---

## Code map (primary)

| Area | Location |
|------|----------|
| Store / UI state | `lib/store.ts` |
| Canonical facts | `lib/investigationCanonical.ts`, `lib/cases/harlow-manor.ts` |
| Interrogation transport | `lib/investigation/investigationService.ts`, `*InvestigationEngine*.ts` |
| Contradictions | `lib/investigation/contradictionEngine.ts` |
| Evidence examination | `lib/investigation/evidenceExamination.ts` |
| Accusation & verdict | `lib/investigation/accusationSubmission.ts`, `verdictGeneration.ts` |
| System prompts (dialogue only) | `lib/investigation/interrogationPromptBuilder.ts`, `harlowInterrogationCanon.ts` |
