/**
 * @fileoverview Agent Executor - Formal execution skeleton with middleware integration.
 *
 * This module provides the formal execution skeleton for agent runs,
 * integrating the middleware chain (before/after/wrap seams) with actual
 * LLM provider calls.
 *
 * The execution flow:
 * 1. before_agent hooks - preprocessing before agent round
 * 2. before_model hooks - preprocessing before LLM call
 * 3. wrap_model_call hooks - wrapping the actual LLM API call
 * 4. after_model hooks - postprocessing after LLM response
 * 5. after_agent hooks - postprocessing after agent round
 *
 * Middleware exceptions fail-open with warning logging by default.
 */
import { type AgentMiddlewareChain, type MiddlewareContext } from "./agent-middleware-chain.js";
import { type LoopDetectionState, type LoopDetectionConfig, type LoopPattern } from "./loop-detection.js";
import { type PromptPartitionUsage } from "./prompt-partition-cache.js";
export interface AgentExecutorOptions {
    failOpen?: boolean;
    loopDetection?: LoopDetectionConfig | null;
    logger?: (code: string, msg: string, ctx: MiddlewareContext) => void;
}
export interface AgentExecutorContext {
    traceId: string;
    taskId: string;
    executionId: string;
    sessionId?: string;
    stepId?: string;
    agentRound: number;
}
export interface AgentExecutorInput {
    request: string;
    history: unknown[];
    messages: unknown[];
    model?: string;
    context: AgentExecutorContext;
}
export interface AgentExecutorResult {
    response: unknown;
    warnings: string[];
    beforeAgentWarnings: string[];
    beforeModelWarnings: string[];
    afterModelWarnings: string[];
    afterAgentWarnings: string[];
    promptCache: PromptPartitionUsage | null;
    loopDetection?: {
        patterns: LoopPattern[];
        escalated: boolean;
    };
}
export interface InitializedAgentExecutorContext {
    chain: AgentMiddlewareChain;
    loopDetection: {
        state: LoopDetectionState | null;
        patterns: () => LoopPattern[];
        reset: () => void;
        getRepeatCount: (toolName: string, input: unknown) => number;
    };
}
export declare function initializeAgentExecutor(options?: AgentExecutorOptions): InitializedAgentExecutorContext;
export declare function getAgentExecutorContext(): InitializedAgentExecutorContext | null;
export declare function getGlobalAgentMiddlewareChain(): AgentMiddlewareChain;
export declare class AgentExecutor {
    private readonly chain;
    private readonly loopState;
    private readonly loopPatterns;
    private agentRound;
    constructor(options?: AgentExecutorOptions);
    getRegisteredHooks(): ReturnType<AgentMiddlewareChain["getRegisteredHooks"]>;
    getLoopDetectionPatterns(): LoopPattern[];
    resetLoopDetection(): void;
    executeAgentRound(input: AgentExecutorInput, executeModel: () => Promise<unknown>): Promise<AgentExecutorResult>;
    wrapToolCall<T>(toolName: string, args: Record<string, unknown>, next: () => Promise<T>): Promise<{
        result: T;
        warnings: string[];
    }>;
}
export declare function createAgentExecutor(options?: AgentExecutorOptions): AgentExecutor;
