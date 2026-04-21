/**
 * @fileoverview Agent Runtime Middleware Chain - Formal execution hooks.
 *
 * Provides before/after/wrap seams that integrate loop detection, compaction,
 * tool repair, and memory update into the main execution chain.
 *
 * Hooks: before_agent / before_model / after_model / wrap_model_call /
 *        wrap_tool_call / after_agent
 *
 * Middleware exceptions fail-open with warning logging.
 */
import type { RuntimeContextSnapshot } from "./runtime-context.js";
/**
 * Result of a middleware hook execution.
 */
export interface MiddlewareResult {
    success: boolean;
    input?: unknown;
    error?: {
        code: string;
        message: string;
        warning?: boolean;
    };
    continueOnError?: boolean;
}
/**
 * Context passed to all middleware hooks.
 */
export interface MiddlewareContext {
    runtime: RuntimeContextSnapshot;
    chainStartedAt: string;
    agentRound: number;
    stepId: string | null;
    executionId: string | null;
    taskId: string;
}
/**
 * Base middleware hook interface.
 */
export interface MiddlewareHook {
    name: string;
    priority: number;
}
/**
 * before_agent - Called before the agent begins a new round.
 */
export interface BeforeAgentHook extends MiddlewareHook {
    run(ctx: MiddlewareContext, input: {
        request: string;
        history: unknown[];
    }): MiddlewareResult | Promise<MiddlewareResult>;
}
/**
 * before_model - Called before making an LLM API call.
 */
export interface BeforeModelHook extends MiddlewareHook {
    run(ctx: MiddlewareContext, input: {
        messages: unknown[];
        model?: string;
    }): MiddlewareResult | Promise<MiddlewareResult>;
}
/**
 * after_model - Called after receiving an LLM response.
 */
export interface AfterModelHook extends MiddlewareHook {
    run(ctx: MiddlewareContext, input: {
        messages: unknown[];
        response: unknown;
    }): MiddlewareResult | Promise<MiddlewareResult>;
}
/**
 * wrap_model_call - Wraps the actual LLM API call.
 */
export interface WrapModelCallHook extends MiddlewareHook {
    run<T>(ctx: MiddlewareContext, input: {
        messages: unknown[];
        model?: string;
    }, next: () => Promise<T>): Promise<T>;
}
/**
 * wrap_tool_call - Wraps a tool execution call.
 */
export interface WrapToolCallHook extends MiddlewareHook {
    run<T>(ctx: MiddlewareContext, input: {
        toolName: string;
        args: Record<string, unknown>;
    }, next: () => Promise<T>): Promise<T>;
}
/**
 * after_agent - Called after agent round completes.
 */
export interface AfterAgentHook extends MiddlewareHook {
    run(ctx: MiddlewareContext, input: {
        response: unknown;
        toolsUsed: string[];
    }): MiddlewareResult | Promise<MiddlewareResult>;
}
export declare class AgentMiddlewareChain {
    private readonly options;
    private _beforeAgentHooks;
    private _beforeModelHooks;
    private _afterModelHooks;
    private _wrapModelCallHooks;
    private _wrapToolCallHooks;
    private _afterAgentHooks;
    constructor(options?: {
        failOpen?: boolean;
        logger?: (code: string, msg: string, ctx: MiddlewareContext) => void;
    });
    /**
     * C-04: Binary insertion using copy-on-write for atomic updates.
     * Creates new sorted array and atomically reassigns reference.
     */
    private sortedInsert;
    /**
     * C-05: Reset all hooks - clears the middleware chain state.
     * Called by resetMiddleware() to ensure clean state on re-initialization.
     */
    reset(): void;
    registerBeforeAgent(hook: BeforeAgentHook): void;
    registerBeforeModel(hook: BeforeModelHook): void;
    registerAfterModel(hook: AfterModelHook): void;
    registerWrapModelCall(hook: WrapModelCallHook): void;
    registerWrapToolCall(hook: WrapToolCallHook): void;
    registerAfterAgent(hook: AfterAgentHook): void;
    private logWarning;
    private runHookChain;
    beforeAgent(input: {
        request: string;
        history: unknown[];
    }, opts?: {
        agentRound?: number;
        stepId?: string;
        ctx?: MiddlewareContext;
    }): Promise<{
        input: {
            request: string;
            history: unknown[];
        };
        warnings: string[];
    }>;
    beforeModel(input: {
        messages: unknown[];
        model?: string;
    }, opts?: {
        agentRound?: number;
        stepId?: string;
        ctx?: MiddlewareContext;
    }): Promise<{
        input: {
            messages: unknown[];
            model?: string;
        };
        warnings: string[];
    }>;
    afterModel(input: {
        messages: unknown[];
        response: unknown;
    }, opts?: {
        agentRound?: number;
        stepId?: string;
        ctx?: MiddlewareContext;
    }): Promise<{
        response: unknown;
        warnings: string[];
    }>;
    wrapModelCall<T>(input: {
        messages: unknown[];
        model?: string;
    }, next: () => Promise<T>, opts?: {
        agentRound?: number;
        stepId?: string;
        ctx?: MiddlewareContext;
    }): Promise<{
        result: T;
        warnings: string[];
    }>;
    wrapToolCall<T>(input: {
        toolName: string;
        args: Record<string, unknown>;
    }, next: () => Promise<T>, opts?: {
        agentRound?: number;
        stepId?: string;
        ctx?: MiddlewareContext;
    }): Promise<{
        result: T;
        warnings: string[];
    }>;
    afterAgent(input: {
        response: unknown;
        toolsUsed: string[];
    }, opts?: {
        agentRound?: number;
        stepId?: string;
        ctx?: MiddlewareContext;
    }): Promise<{
        warnings: string[];
    }>;
    runAgentRound<T>(options: {
        request: string;
        history: unknown[];
        messages: unknown[];
        model?: string;
        agentRound: number;
        stepId?: string;
        executeModel: () => Promise<T>;
    }): Promise<{
        result: T;
        warnings: string[];
        beforeAgentWarnings: string[];
        beforeModelWarnings: string[];
        afterModelWarnings: string[];
        afterAgentWarnings: string[];
    }>;
    private buildContext;
    getRegisteredHooks(): {
        beforeAgent: string[];
        beforeModel: string[];
        afterModel: string[];
        wrapModelCall: string[];
        wrapToolCall: string[];
        afterAgent: string[];
    };
}
export declare const globalMiddlewareChain: AgentMiddlewareChain;
export declare function createMiddlewareChain(options?: {
    failOpen?: boolean;
    logger?: (code: string, msg: string, ctx: MiddlewareContext) => void;
}): AgentMiddlewareChain;
