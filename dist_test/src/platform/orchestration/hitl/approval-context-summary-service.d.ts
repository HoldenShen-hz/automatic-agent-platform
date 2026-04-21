/**
 * @fileoverview Approval Context Summary Service
 *
 * Generates human-readable execution summaries for approval UI using LLM.
 * This allows approvers to quickly understand the context without
 * manually reviewing all execution logs.
 */
import { type UnifiedChatProvider } from "../../model-gateway/provider-registry/unified-chat-provider.js";
export interface ExecutionContextForSummary {
    taskId: string;
    executionId?: string | null;
    title?: string;
    stageRef?: string;
    riskLevel?: string;
    currentPhase?: string;
    completedSteps?: Array<{
        stepId: string;
        stepName: string;
        status: string;
        durationMs?: number;
        summary?: string;
    }>;
    blockers?: string[];
    errorCount?: number;
    retryCount?: number;
    outputSummary?: string;
    relevantArtifacts?: Array<{
        artifactId: string;
        artifactType: string;
        name: string;
    }>;
}
export interface ApprovalContextSummary {
    summaryId: string;
    taskId: string;
    executionId: string | null;
    generatedAt: string;
    summary: string;
    keyPoints: string[];
    riskFactors: string[];
    recommendedAction?: string;
    confidence: number;
}
export interface ApprovalContextSummaryServiceOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    provider?: UnifiedChatProvider;
}
export declare class ApprovalContextSummaryService {
    private readonly model;
    private readonly maxTokens;
    private readonly temperature;
    private readonly provider;
    constructor(options?: ApprovalContextSummaryServiceOptions);
    generateSummary(context: ExecutionContextForSummary): Promise<ApprovalContextSummary>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseSummaryFromResponse;
    private fallbackTemplateSummary;
    private templateSummary;
    private defaultKeyPoints;
    private defaultRiskFactors;
    private defaultRecommendedAction;
}
