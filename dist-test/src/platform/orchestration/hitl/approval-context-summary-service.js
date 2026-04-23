/**
 * @fileoverview Approval Context Summary Service
 *
 * Generates human-readable execution summaries for approval UI using LLM.
 * This allows approvers to quickly understand the context without
 * manually reviewing all execution logs.
 */
import { createUnifiedChatProvider, } from "../../model-gateway/provider-registry/unified-chat-provider.js";
import { AppError } from "../../contracts/errors.js";
import { newId } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 200 });
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
export class ApprovalContextSummaryService {
    model;
    maxTokens;
    temperature;
    provider;
    constructor(options = {}) {
        this.model = options.model ?? DEFAULT_MODEL;
        this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
        this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
        this.provider = options.provider ?? createUnifiedChatProvider();
    }
    async generateSummary(context) {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(context);
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];
        try {
            const result = await this.provider.createChatCompletion({
                model: this.model,
                messages,
                maxTokens: this.maxTokens,
                temperature: this.temperature,
            });
            return this.parseSummaryFromResponse(result.content, context);
        }
        catch (error) {
            if (error instanceof AppError && !error.retryable) {
                logger.warn("[ApprovalContextSummaryService] LLM call failed non-retryably, falling back to template", { error: error.message });
                return this.fallbackTemplateSummary(context);
            }
            logger.warn("[ApprovalContextSummaryService] LLM call failed, falling back to template", { error: String(error) });
            return this.fallbackTemplateSummary(context);
        }
    }
    buildSystemPrompt() {
        return `You are an approval context summarizer for a multi-step task execution platform.
Your role is to generate clear, concise summaries of task execution contexts for human approvers.

For each context, you must produce a JSON object with:
- summary: A 2-3 sentence overview of what happened and why approval is needed
- keyPoints: Array of 3-5 bullet points highlighting critical information
- riskFactors: Array of specific risk-related observations
- recommendedAction: One sentence on what the approver should do
- confidence: A score between 0.0 and 1.0 reflecting summary quality

Be specific and actionable. Focus on:
- What the task was trying to accomplish
- What went wrong or needs attention
- Why human approval is required
- What the potential impact is

Output format: Return a valid JSON object.`;
    }
    buildUserPrompt(context) {
        const stepsText = context.completedSteps && context.completedSteps.length > 0
            ? context.completedSteps.map((step) => `- ${step.stepName} (${step.status}${step.durationMs ? `, ${step.durationMs}ms` : ""}): ${step.summary ?? "no summary"}`).join("\n")
            : "No steps recorded";
        const blockersText = context.blockers && context.blockers.length > 0
            ? context.blockers.join("; ")
            : "None";
        const artifactsText = context.relevantArtifacts && context.relevantArtifacts.length > 0
            ? context.relevantArtifacts.map((a) => `${a.name} (${a.artifactType})`).join(", ")
            : "None";
        return `Generate an approval context summary for the following task:

**Task ID**: ${context.taskId}
**Execution ID**: ${context.executionId ?? "N/A"}
**Title**: ${context.title ?? "Untitled task"}
**Stage**: ${context.stageRef ?? "unknown"}
**Risk Level**: ${context.riskLevel ?? "unknown"}
**Current Phase**: ${context.currentPhase ?? "unknown"}

**Completed Steps**:
${stepsText}

**Blockers**: ${blockersText}

**Error Count**: ${context.errorCount ?? 0}
**Retry Count**: ${context.retryCount ?? 0}

**Output Summary**: ${context.outputSummary ?? "No output available"}

**Relevant Artifacts**: ${artifactsText}

Return a JSON object with summary, keyPoints, riskFactors, recommendedAction, and confidence.`;
    }
    parseSummaryFromResponse(content, context) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.fallbackTemplateSummary(context);
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                summaryId: newId("approval_summary"),
                taskId: context.taskId,
                executionId: context.executionId ?? null,
                generatedAt: new Date().toISOString(),
                summary: parsed.summary ?? this.templateSummary(context),
                keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : this.defaultKeyPoints(context),
                riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : this.defaultRiskFactors(context),
                recommendedAction: parsed.recommendedAction ?? this.defaultRecommendedAction(context),
                confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
            };
        }
        catch (error) {
            logger.warn("[ApprovalContextSummaryService] Failed to parse LLM response as JSON, falling back to template", { error: String(error) });
            return this.fallbackTemplateSummary(context);
        }
    }
    fallbackTemplateSummary(context) {
        return {
            summaryId: newId("approval_summary"),
            taskId: context.taskId,
            executionId: context.executionId ?? null,
            generatedAt: new Date().toISOString(),
            summary: this.templateSummary(context),
            keyPoints: this.defaultKeyPoints(context),
            riskFactors: this.defaultRiskFactors(context),
            recommendedAction: this.defaultRecommendedAction(context),
            confidence: 0.4,
        };
    }
    templateSummary(context) {
        const stage = context.stageRef ?? "unknown";
        const risk = context.riskLevel ?? "unknown";
        const errorCount = context.errorCount ?? 0;
        const retryCount = context.retryCount ?? 0;
        if (errorCount > 0) {
            return `Task ${context.taskId} requires approval due to ${errorCount} error(s) encountered during ${stage} stage. ` +
                `Risk level is ${risk} with ${retryCount} retry attempt(s).`;
        }
        if (context.blockers && context.blockers.length > 0) {
            return `Task ${context.taskId} is blocked during ${stage} stage and requires human approval to proceed. ` +
                `Risk level is ${risk}.`;
        }
        return `Task ${context.taskId} requires approval at ${stage} stage. ` +
            `Risk level is ${risk}.`;
    }
    defaultKeyPoints(context) {
        const points = [];
        if (context.completedSteps && context.completedSteps.length > 0) {
            points.push(`${context.completedSteps.length} step(s) completed in ${context.stageRef ?? "unknown"} stage`);
        }
        if (context.errorCount && context.errorCount > 0) {
            points.push(`${context.errorCount} error(s) encountered`);
        }
        if (context.retryCount && context.retryCount > 0) {
            points.push(`${context.retryCount} retry attempt(s) made`);
        }
        if (context.riskLevel) {
            points.push(`Risk level: ${context.riskLevel}`);
        }
        if (context.blockers && context.blockers.length > 0) {
            points.push(`Blockers: ${context.blockers.length}`);
        }
        return points.length > 0 ? points : ["No critical issues detected"];
    }
    defaultRiskFactors(context) {
        const factors = [];
        if (context.riskLevel === "critical" || context.riskLevel === "high") {
            factors.push(`High-risk operation (${context.riskLevel}) requires explicit approval`);
        }
        if (context.errorCount && context.errorCount > 2) {
            factors.push("Multiple errors may indicate systemic issues");
        }
        if (context.blockers && context.blockers.length > 0) {
            factors.push("Execution is blocked pending human decision");
        }
        return factors.length > 0 ? factors : ["Standard approval process applies"];
    }
    defaultRecommendedAction(context) {
        if (context.riskLevel === "critical") {
            return "Review carefully before approving - this is a critical risk operation";
        }
        if (context.errorCount && context.errorCount > 0) {
            return "Review error details and confirm resolution before approving";
        }
        return "Review the task context and approve or reject based on policy";
    }
}
//# sourceMappingURL=approval-context-summary-service.js.map