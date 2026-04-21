import { type ToolExecutionMetadata } from "./tool-metadata.js";
import { type ResolvedSkillStep, type SkillDefinition, type SkillExecutionRequest, type SkillExecutionResult, type SkillToolCallRequest, type SkillToolCallResult } from "./skill-execution-support.js";
import type { SkillExecutionService } from "./skill-execution-service.js";
export declare const skillExecutionCoreMethods: {
    readonly execute: (this: SkillExecutionService, input: SkillExecutionRequest) => Promise<SkillExecutionResult>;
    readonly executeToolCallWithPolicy: (this: SkillExecutionService, request: Omit<SkillToolCallRequest, "timeoutMs" | "recoveryStrategy">, metadata: ToolExecutionMetadata | null) => Promise<SkillToolCallResult>;
    readonly normalizeToolCallResult: (this: SkillExecutionService, result: SkillToolCallResult, metadata: ToolExecutionMetadata | null, startedAtMs: number) => SkillToolCallResult;
    readonly validateSkillDefinition: (this: SkillExecutionService, skill: SkillDefinition) => void;
    readonly validateResolvedSteps: (this: SkillExecutionService, skill: SkillDefinition, resolvedSteps: readonly ResolvedSkillStep[]) => void;
    readonly validateAllowedTools: (this: SkillExecutionService, skill: SkillDefinition, resolvedSteps: readonly ResolvedSkillStep[], allowedTools: readonly string[] | undefined) => void;
};
