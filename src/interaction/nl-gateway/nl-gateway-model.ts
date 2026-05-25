import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import type { PlatformRequestEnvelope } from "../../platform/contracts/index.js";
import type {
  ConfirmedTaskSpec,
  JsonValue,
  RequestEnvelope as CanonicalRequestEnvelope,
  TaskDraft as CanonicalTaskDraft,
} from "../../platform/contracts/executable-contracts/index.js";
import type { RequestEnvelopeLegacy } from "../../platform/contracts/types/index.js";
import type { IntakeRouter } from "../../platform/five-plane-orchestration/routing/intake-router.js";
import type { NlGatewayConfig } from "./nl-gateway-config-loader.js";

export interface NlEntryRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly message: string;
  readonly locale?: string;
  readonly preferredLocale?: string;
  readonly acceptLanguage?: string;
  readonly channel?: string;
}

export interface NlEntryIntent {
  readonly intent: string;
  readonly confidence: number;
  readonly entities: Record<string, string>;
}

export interface NlEntryPort {
  parse(request: NlEntryRequest): Promise<NlEntryIntent>;
}

export interface ExtractedEntity {
  readonly entityType: string;
  readonly value: string;
  readonly normalized: unknown;
  readonly sourceSpan: readonly [number, number];
}

export interface DetectedIntent {
  readonly intentType:
    | "task_create"
    | "task_query"
    | "task_modify"
    | "cancel_task"
    | "create_goal"
    | "decompress_goal"
    | "status_inquiry"
    | "approval_action"
    | "why";
  readonly domainHint: string | null;
  readonly entities: readonly ExtractedEntity[];
  readonly urgency: "low" | "normal" | "high" | "critical";
  readonly confidence: number;
}

export interface IntentParseResult {
  readonly rawInput: string;
  readonly detectedIntents: readonly DetectedIntent[];
  readonly confidence: number;
  readonly requiresClarification: boolean;
  readonly clarificationQuestions?: readonly string[];
  readonly locale: string;
  readonly continuation: "new_task" | "follow_up" | "correction";
  readonly suggestedDivisionId: string;
  readonly suggestedWorkflowId: string;
  readonly conversationState: ConversationState;
  readonly clarificationState: ClarificationState;
  readonly context: ContextEnrichment;
  readonly securityFindings: readonly PromptInjectionFinding[];
  readonly blockedByPolicy: boolean;
  readonly priorConversationTurns: readonly ConversationTurn[];
  // R5-16: Independent risk classification result (separate pipeline stage from intent parsing)
  readonly riskClassification: {
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly riskFactors: readonly string[];
    readonly requiresApproval: boolean;
  };
}

export interface RiskPreview {
  readonly overallRisk: "low" | "medium" | "high" | "critical";
  readonly riskFactors: readonly string[];
  readonly reversible: boolean;
  readonly sideEffects: readonly string[];
  readonly approvalNeeded: boolean;
}

export interface NlRequestPayload {
  readonly userId: string;
  readonly title: string;
  readonly request: string;
  readonly locale: string;
  readonly channel: string | null;
  readonly divisionId: string;
  readonly workflowId: string;
  readonly intent: DetectedIntent["intentType"];
  readonly continuation: IntentParseResult["continuation"];
  readonly entities: readonly ExtractedEntity[];
  readonly confirmationRequired: boolean;
  readonly generatedSummary: string;
}

export type RequestEnvelope = PlatformRequestEnvelope;

export type ConversationState =
  | "Idle"
  | "IntentParsing"
  | "Clarifying"
  | "Building"
  | "Confirming"
  | "Executing"
  | "Reporting";

export interface PromptInjectionFinding {
  readonly reasonCode: string;
  readonly severity: "low" | "medium" | "high";
  readonly blocked: boolean;
  readonly matchedText: string;
}

export interface ContextEnrichment {
  readonly domainHint: string;
  readonly extractedConstraints: readonly string[];
  readonly targetEnvironments: readonly string[];
  readonly requestedChannels: readonly string[];
  readonly timelineRefs: readonly string[];
  readonly requiredSlots?: readonly string[];
  readonly missingSlots?: readonly string[];
  readonly resolvedSlots?: Readonly<Record<string, unknown>>;
}

export interface TaskDraft {
  readonly draftId: string;
  readonly rawInput: string;
  readonly locale: string;
  readonly intent: DetectedIntent;
  readonly context: ContextEnrichment;
  readonly riskPreview: RiskPreview;
  readonly state: Extract<ConversationState, "Building" | "Confirming" | "Executing">;
}

export interface ClarificationState {
  readonly state: "none" | "required" | "blocked";
  readonly reasonCodes: readonly string[];
  readonly questions: readonly string[];
  // R5-30: Round tracking for clarification sessions
  readonly rounds: number;
  readonly maxRounds: number;
}

export interface UserConfirmationReceipt {
  readonly confirmationId: string;
  readonly required: boolean;
  readonly state: "not_required" | "pending_user_confirmation" | "confirmed";
  readonly reasonCodes: readonly string[];
  readonly summary: string;
  // R5-32: Additional confirmation receipt fields
  readonly scope?: string;
  readonly time?: string;
  readonly riskPreviewVersion?: string;
  // R5-40: Extended confirmation receipt fields
  readonly riskPreview?: RiskPreview;
  readonly actor?: string;
  readonly timestamp?: string;
}

export interface TaskBuildResult {
  readonly requestEnvelope: RequestEnvelopeLegacy | null;
  readonly riskPreview: RiskPreview;
  readonly costEstimate: CostEstimate;
  readonly confirmationRequired: boolean;
  readonly humanSummary: string;
  readonly taskDraft: TaskDraft;
  readonly clarificationState: ClarificationState;
  readonly confirmationReceipt: UserConfirmationReceipt;
  readonly conversationState: ConversationState;
  readonly clarificationSession: ClarificationSession | null;
  readonly canonicalTaskDraft: CanonicalTaskDraft;
  readonly confirmedTaskSpec: ConfirmedTaskSpec | null;
  readonly canonicalRequestEnvelope: CanonicalRequestEnvelope | null;
  readonly dryRunPreview?: DryRunPreview;
}

export interface LocaleConfig {
  readonly supportedLocales: readonly string[];
  readonly defaultLocale: string;
  readonly localeResolutionOrder?: readonly LocaleResolutionSource[];
}

export type LocaleResolutionSource = "user_profile" | "accept_language" | "input_detect" | "default";

export interface CostEstimatorPort {
  estimate(divisionId?: string | null): CostEstimate;
}

export interface IntentParserLlmResult {
  readonly intentType: DetectedIntent["intentType"];
  readonly confidence: number;
  readonly reasoning?: string;
  readonly language?: string;
}

export interface IntentParserPort {
  parseWithLlm?(input: {
    readonly message: string;
    readonly locale: string;
    readonly priorConversationContext?: ConversationContext;
  }): Promise<IntentParserLlmResult>;
}

export interface MemoryServicePort {
  remember(input: {
    readonly scope: string;
    readonly content: string;
    readonly classification?: string;
  }): void;
  findMemories(query: {
    readonly scope: string;
  }): readonly { readonly content: string }[];
}

export interface NlEntryServiceOptions {
  readonly intakeRouter?: IntakeRouter;
  readonly costEstimator?: CostEstimatorPort | null;
  readonly clarificationThreshold?: number;
  readonly localeConfig?: LocaleConfig;
  readonly conversationWindowSize?: number;
  readonly nlGatewayConfig?: NlGatewayConfig;
  readonly intentParser?: IntentParserPort;
  readonly memoryService?: MemoryServicePort;
  // R9-41: Dry-run executor for actual risk preview
  readonly dryRunExecutor?: DryRunExecutorPort | null;
}

export interface ClarificationSession {
  readonly sessionId: string;
  readonly taskDraftId: string;
  readonly stage: "pending_clarification";
}

export interface DryRunPreview {
  readonly mode: "dry_run";
  readonly blocked: boolean;
  readonly approvalRequired: boolean;
  readonly scope: string;
  readonly proposedOperations: readonly string[];
  readonly sideEffectPreview: readonly string[];
  readonly policyChecks: readonly string[];
  readonly proposedPayload: {
    readonly userId: string;
    readonly divisionId: string;
    readonly workflowId: string;
  };
}


/**
 * R9-41: DryRunExecutor port for actual execution during risk preview
 */
export interface DryRunExecutorPort {
  executeDryRun(input: {
    readonly message: string;
    readonly divisionId: string;
    readonly workflowId: string;
    readonly userId: string;
    readonly locale: string;
  }): Promise<{
    readonly blocked: boolean;
    readonly actualRiskLevel: "low" | "medium" | "high" | "critical";
    readonly detectedSideEffects: readonly string[];
    readonly policyCheckResults: readonly string[];
  }>;
}

/**
 * Conversation context for multi-turn dialogs.
 */
export interface ConversationContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly turnCount: number;
  readonly maxTurns: number;
  readonly turns: readonly ConversationTurn[];
  readonly lastIntent?: DetectedIntent;
}

export interface ConversationTurn {
  readonly turnNumber: number;
  readonly message: string;
  readonly detectedIntent: DetectedIntent;
  readonly timestamp: string;
}

export interface ConversationContextManagerOptions {
  readonly maxActiveContexts?: number;
}
