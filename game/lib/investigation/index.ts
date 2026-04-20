export type {
  CaseSession,
  ContradictionEvent,
  ContradictionSeverity,
  ExamineEvidenceResult,
  GameCase,
  Evidence,
  EvidenceId,
  InterrogationRequest,
  InterrogationResult,
  InterrogationStreamChunk,
  InterrogationTurn,
  InvestigationSessionState,
  SpeakRequest,
  ResolvedVerdict,
  Suspect,
  SuspectId,
  VerdictAdjudicationSnapshot,
  VerdictResult,
} from "./types";

export {
  getVerdict,
  interrogateSuspect,
  mergeExaminedEvidenceIds,
  startCaseSession,
  synthesizeSpeech,
} from "./investigationService";

export type { InterrogationTurnStoreSnapshot } from "./interrogationTurn";

export type { InterrogationContradictionEngineInput } from "./contradictionEngine";

export {
  normalizeContradictionEvent,
  runInterrogationContradictionEngine,
  stressDeltaForNewContradictions,
} from "./contradictionEngine";

export type { EvidenceExaminationDetail } from "./evidenceExamination";

export {
  buildEvidenceExaminationDetail,
  getFactsUnlockedByEvidence,
  mergeUnlockedFactIds,
} from "./evidenceExamination";

export type {
  AccusationEngineResult,
  AccusationSubmissionMeta,
  AccusationSubmissionPayload,
  AccusationValidationResult,
} from "./accusationSubmission";

export { executeAccusationSubmission, validateAccusationPayload } from "./accusationSubmission";

export {
  buildResolvedVerdictFromCanonicalInputs,
  buildVerdictResultFromCanonicalTruth,
} from "./verdictGeneration";

export type { InterrogationPostBody } from "./interrogationApiContract";
export { parseInterrogationPostBody } from "./interrogationApiContract";

export {
  buildEvidenceContextForPrompt,
  buildInterrogationSystemPrompt,
} from "./interrogationPromptBuilder";

export {
  calculateQuestionStressImpact,
  interrogationBottomStressHint,
  interrogationPortraitStressed,
  interrogationStressBarColor,
  interrogationStressTopBarLabel,
  isReassuringQuestion,
  QUESTION_STRESS_KEYWORDS,
  stressBandFromNumericLevel,
  stressBandInstructionFragment,
} from "./interrogationStressRules";

export type { StressBand } from "./interrogationStressRules";

export {
  INTERROGATION_EMPTY_STATE_INTRO,
  INTERROGATION_STRESS_FOLLOWUP_QUESTIONS,
  INTERROGATION_STRESS_FOLLOWUP_THRESHOLD,
  INTERROGATION_SUGGESTED_QUESTIONS,
} from "./interrogationUiCopy";

export type { CaseSessionAdapter, CaseSessionRunSource, InvestigationHydration } from "./sessionInitialization";

export {
  createLocalInvestigationHydration,
  FallbackCaseSessionAdapter,
  getDefaultCaseSessionAdapter,
  initializeInvestigationSession,
  LocalCaseSessionAdapter,
  setDefaultCaseSessionAdapter,
  tryAugmentBackendSession,
  tryBackendSessionToken,
} from "./sessionInitialization";

export type { InvestigationEngine } from "./investigationEngine.types";

export {
  getInvestigationEngine,
  resetInvestigationEngineSingleton,
  setInvestigationEngine,
} from "./investigationEngineProvider";

export type { InvestigationRuntimeMode } from "./investigationRuntimeConfig";

export { getBackendApiBase, getInvestigationRuntimeMode } from "./investigationRuntimeConfig";

export {
  resolveInterrogationLlmProvider,
  type InterrogationLlmProviderName,
  type ResolveInterrogationProviderResult,
} from "./interrogationLlmProvider";
