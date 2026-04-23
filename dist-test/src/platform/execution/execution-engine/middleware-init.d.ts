/**
 * @fileoverview Runtime Middleware Initialization - Formal execution skeleton.
 *
 * This module initializes the global middleware chain with core middleware
 * like loop detection, and provides utilities for middleware management.
 *
 * All middleware registered here is automatically wired into the global
 * execution chain via globalMiddlewareChain.
 */
import { type AgentMiddlewareChain } from "./agent-middleware-chain.js";
import { type LoopDetectionState, type LoopDetectionConfig, type LoopPattern } from "./loop-detection.js";
export interface InitializedMiddlewareContext {
    chain: AgentMiddlewareChain;
    loopDetection: {
        state: LoopDetectionState | null;
        patterns: () => LoopPattern[];
        reset: () => void;
        getRepeatCount: (toolName: string, input: unknown) => number;
    };
}
export interface MiddlewareInitOptions {
    loopDetection?: LoopDetectionConfig | null;
    failOpen?: boolean;
}
export declare function initializeMiddleware(options?: MiddlewareInitOptions): InitializedMiddlewareContext;
export declare function getMiddlewareContext(): InitializedMiddlewareContext | null;
export declare function getGlobalMiddlewareChain(): AgentMiddlewareChain;
export declare function resetMiddleware(): void;
