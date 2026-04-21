export { detectAmbiguity } from "./ambiguity-handler/index.js";
export * from "./disambiguation-handler/index.js";
export * from "./intent-parser/index.js";
export * from "./slot-resolver/index.js";
import { type NlGatewayConfig, type ConversationWindowConfig, type DisambiguationConfig, type IntentConfig, type EntityExtractionConfig } from "./nl-gateway-config-loader.js";
export { loadNlGatewayConfig, getConversationWindowSize, shouldRequestClarification, } from "./nl-gateway-config-loader.js";
export type { NlGatewayConfig, ConversationWindowConfig, DisambiguationConfig, IntentConfig, EntityExtractionConfig, };
import { IntakeRouter } from "../../platform/orchestration/routing/intake-router.js";
import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import { type RequestEnvelope as PlatformRequestEnvelope } from "../../platform/contracts/types/index.js";
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
    readonly intentType: "task_create" | "task_query" | "task_modify" | "system_config" | "status_inquiry" | "approval_action";
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
export type RequestEnvelope = PlatformRequestEnvelope<NlRequestPayload>;
export interface TaskBuildResult {
    readonly requestEnvelope: RequestEnvelope;
    readonly riskPreview: RiskPreview;
    readonly costEstimate: CostEstimate;
    readonly confirmationRequired: boolean;
    readonly humanSummary: string;
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
export interface NlEntryServiceOptions {
    readonly intakeRouter?: IntakeRouter;
    readonly costEstimator?: CostEstimatorPort | null;
    readonly clarificationThreshold?: number;
    readonly localeConfig?: LocaleConfig;
    readonly conversationWindowSize?: number;
    readonly nlGatewayConfig?: NlGatewayConfig;
}
/**
 * Conversation context for multi-turn dialogs
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
export declare class NlEntryService implements NlEntryPort {
    private readonly intakeRouter;
    private readonly costEstimator;
    private readonly clarificationThreshold;
    private readonly localeConfig;
    private readonly conversationWindowSize;
    private readonly nlConfig;
    constructor(options?: NlEntryServiceOptions);
    /**
     * Get the configured conversation window size for a given task type
     */
    getConversationWindowSize(taskType?: string): number;
    /**
     * Get the configured clarification threshold
     */
    getClarificationThreshold(): number;
    /**
     * Check if clarification should be requested based on config
     */
    shouldRequestClarification(confidence: number): boolean;
    parse(request: NlEntryRequest): Promise<NlEntryIntent>;
    parseDetailed(request: NlEntryRequest): Promise<IntentParseResult>;
    buildTask(request: NlEntryRequest): Promise<TaskBuildResult>;
    private resolveLocale;
}
/**
 * Conversation Context Manager
 *
 * Manages multi-turn conversation context with configurable window size.
 * Window size can be configured per task type via nlGatewayConfig.
 */
export declare class ConversationContextManager {
    private readonly contexts;
    private readonly nlConfig;
    constructor(nlConfig?: NlGatewayConfig);
    /**
     * Get or create a conversation context for a user
     */
    getContext(tenantId: string, userId: string, taskType?: string): ConversationContext;
    /**
     * Add a turn to the conversation
     */
    addTurn(tenantId: string, userId: string, message: string, intent: DetectedIntent, taskType?: string): ConversationContext;
    /**
     * Clear a conversation context
     */
    clearContext(tenantId: string, userId: string): void;
    /**
     * Check if conversation is approaching window limit
     */
    isNearWindowLimit(tenantId: string, userId: string): boolean;
    /**
     * Get window size for a specific task type
     */
    getWindowSize(taskType?: string): number;
}
