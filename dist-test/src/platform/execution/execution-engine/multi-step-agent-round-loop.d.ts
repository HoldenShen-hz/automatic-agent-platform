/**
 * @fileoverview Agent round loop and step output builder for multi-step orchestration.
 */
import type { LlmModelCallResult } from "./model-call-provider.js";
import type { MultiStepToolDefinition } from "./multi-step-tool-definitions.js";
export interface AgentRoundLoopInput {
    stepId: string;
    roleId: string;
    request: string;
    priorSummaries: string[];
    routingReason: string;
    tools?: MultiStepToolDefinition[];
    maxIterations?: number;
}
export interface ToolCallResult {
    toolCallId: string;
    toolName: string;
    result: string;
    success: boolean;
}
export interface AgentRoundLoopResult {
    summary: string;
    result: string;
    llmResult: LlmModelCallResult | null;
    toolCalls: ToolCallResult[];
    iterations: number;
    finishReason: "stop" | "max_iterations" | "error";
}
export declare function executeAgentRoundLoop(input: AgentRoundLoopInput): Promise<AgentRoundLoopResult>;
export declare function parseStepOutput(content: string, stepId: string): {
    summary: string;
    result: string;
};
export declare function fallbackStepOutput(input: AgentRoundLoopInput): AgentRoundLoopResult;
export interface BuildStepOutputInput {
    stepId: string;
    roleId: string;
    request: string;
    priorSummaries: string[];
    routingReason: string;
    tools?: MultiStepToolDefinition[];
}
export interface BuildStepOutputResult {
    summary: string;
    result: string;
    llmResult?: LlmModelCallResult;
    toolCalls?: ToolCallResult[];
    iterations?: number;
}
export declare function buildStepOutput(input: BuildStepOutputInput): Promise<BuildStepOutputResult>;
