import { type SkillEventType, type TypedEventPayloadMap } from "../../state-evidence/events/typed-event-bus.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AgentExecutionRecord, StepOutputRecord } from "../../contracts/types/domain.js";
import type { ExecutionResourceCeilingFinding } from "../dispatcher/execution-resource-ceiling-guard.js";
import { type CacheLookup, type CachedSkillExecutionEntry, type CachedSkillStepResult, type ResolvedSkillModelProfile, type ResolvedSkillStep, type SkillDefinition, type SkillExecutionCacheMetadata, type SkillExecutionCachePolicy, type SkillExecutionResult, type SkillStepExecutionResult, type SkillToolCallResult } from "./skill-execution-support.js";
import type { SkillExecutionService } from "./skill-execution-service.js";
export declare const skillExecutionCacheMethods: {
    readonly resolveModelProfile: (this: SkillExecutionService, modelProfileName: string | null | undefined) => ResolvedSkillModelProfile | null;
    readonly resolveSkillSteps: (this: SkillExecutionService, skill: SkillDefinition, modelProfile: ResolvedSkillModelProfile | null) => ResolvedSkillStep[];
    readonly resolveCacheLookup: (this: SkillExecutionService, skill: SkillDefinition, policy: SkillExecutionCachePolicy | undefined) => CacheLookup;
    readonly getCacheEntry: (this: SkillExecutionService, key: string, now: string) => CachedSkillExecutionEntry | null;
    readonly storeCacheEntry: (this: SkillExecutionService, skill: SkillDefinition, metadata: SkillExecutionCacheMetadata, steps: CachedSkillStepResult[], retryCount: number) => SkillExecutionCacheMetadata;
    readonly buildCachedStepResult: (this: SkillExecutionService, input: {
        step: ResolvedSkillStep;
        status: StepOutputRecord["status"];
        attempts: number;
        maxAttempts: number;
        result: SkillToolCallResult;
    }) => CachedSkillStepResult;
    readonly buildStepOutput: (this: SkillExecutionService, taskId: string, skill: SkillDefinition, cachedStep: CachedSkillStepResult, cacheMetadata: SkillExecutionCacheMetadata) => StepOutputRecord;
    readonly buildCachedStepOutput: (this: SkillExecutionService, input: {
        taskId: string;
        skill: SkillDefinition;
        cachedStep: CachedSkillStepResult;
        cacheMetadata: SkillExecutionCacheMetadata;
    }) => StepOutputRecord;
    readonly finalizeResourceLimitFailure: (this: SkillExecutionService, input: {
        execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>;
        skill: SkillDefinition;
        cacheMetadata: SkillExecutionCacheMetadata;
        planJson: string;
        steps: SkillStepExecutionResult[];
        step: ResolvedSkillStep;
        totalToolCalls: number;
        totalRetries: number;
        startedAt: string;
        occurredAt: string;
        finding: ExecutionResourceCeilingFinding;
    }) => SkillExecutionResult;
    readonly publishEvent: <TType extends SkillEventType>(this: SkillExecutionService, eventType: TType, taskId: string, executionId: string, traceId: string, payload: TypedEventPayloadMap[TType]) => void;
    readonly upsertAgentExecutionRecord: (this: SkillExecutionService, executionId: string, input: {
        execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>;
        planJson: string;
        status: string;
        currentStepId: string | null;
        lastToolName: string | null;
        toolCallCount: number;
        retryCount: number;
        progressMessage: string | null;
        lastErrorCode: string | null;
        startedAt: string;
        completedAt: string | null;
        lastDecisionJson: string | null;
        occurredAt: string;
    }) => AgentExecutionRecord;
};
