import type { InvestigationEngine } from "./investigationEngine.types";
import { BackendInvestigationEngine } from "./backendInvestigationEngine";
import { LocalInvestigationEngine } from "./localInvestigationEngine";
import { getInvestigationRuntimeMode } from "./investigationRuntimeConfig";

let engine: InvestigationEngine | null = null;

function createEngine(): InvestigationEngine {
  if (getInvestigationRuntimeMode() === "backend") {
    return new BackendInvestigationEngine();
  }
  return new LocalInvestigationEngine();
}

/**
 * Active interrogation + speech engine (local Next routes vs FastAPI interrogation).
 * Override in tests via `setInvestigationEngine`.
 */
export function getInvestigationEngine(): InvestigationEngine {
  if (!engine) engine = createEngine();
  return engine;
}

/** Test hook or custom wiring (e.g. Storybook). */
export function setInvestigationEngine(next: InvestigationEngine | null): void {
  engine = next;
}

/** Reset singleton so the next `getInvestigationEngine()` respects env (tests). */
export function resetInvestigationEngineSingleton(): void {
  engine = null;
}
