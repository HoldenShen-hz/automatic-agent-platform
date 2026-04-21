/**
 * @fileoverview Runtime Middleware Initialization - Formal execution skeleton.
 *
 * This module initializes the global middleware chain with core middleware
 * like loop detection, and provides utilities for middleware management.
 *
 * All middleware registered here is automatically wired into the global
 * execution chain via globalMiddlewareChain.
 */
import { globalMiddlewareChain, } from "./agent-middleware-chain.js";
import { createLoopDetectionMiddlewareFull, } from "./loop-detection.js";
import { createToolArgumentCoercionMiddleware } from "../tool-executor/tool-argument-coercion.js";
import { initializeCache, createCacheGovernanceMiddleware, createCacheSummaryMiddleware, } from "../../shared/cache/index.js";
import { RuntimeError } from "../../contracts/errors.js";
let middlewareContext = null;
// C-02: Track initialization state to prevent concurrent initialization race conditions
let isInitializing = false;
export function initializeMiddleware(options = {}) {
    if (middlewareContext != null) {
        return middlewareContext;
    }
    // C-02: If initialization is in progress, throw to prevent race condition
    if (isInitializing) {
        throw new RuntimeError("gateway.middleware_initialization_in_progress", "Middleware initialization is already in progress", {
            retryable: false,
        });
    }
    // C-02: Set flag synchronously before starting initialization
    isInitializing = true;
    try {
        const { loopDetection: loopConfig = {}, failOpen = true } = options;
        const registeredHooks = globalMiddlewareChain.getRegisteredHooks();
        if (!registeredHooks.wrapToolCall.includes("tool_argument_coercion")) {
            const toolArgumentCoercion = createToolArgumentCoercionMiddleware();
            globalMiddlewareChain.registerWrapToolCall(toolArgumentCoercion);
        }
        if (!registeredHooks.wrapToolCall.includes("cache-governance")) {
            const cache = initializeCache();
            globalMiddlewareChain.registerWrapToolCall(createCacheGovernanceMiddleware({ cache }));
            globalMiddlewareChain.registerAfterAgent(createCacheSummaryMiddleware({ cache }));
        }
        if (loopConfig !== null) {
            const { beforeAgent, wrapToolCall, state } = createLoopDetectionMiddlewareFull(loopConfig);
            const latestHooks = globalMiddlewareChain.getRegisteredHooks();
            if (!latestHooks.beforeAgent.includes(beforeAgent.name)) {
                globalMiddlewareChain.registerBeforeAgent(beforeAgent);
            }
            if (!latestHooks.wrapToolCall.includes(wrapToolCall.name)) {
                globalMiddlewareChain.registerWrapToolCall(wrapToolCall);
            }
            middlewareContext = {
                chain: globalMiddlewareChain,
                loopDetection: {
                    state,
                    patterns: () => state.getPatterns(),
                    reset: () => state.reset(),
                    getRepeatCount: (toolName, input) => state.getRepeatCount(toolName, input),
                },
            };
        }
        else {
            middlewareContext = {
                chain: globalMiddlewareChain,
                loopDetection: {
                    state: null, // T-18: Removed unsafe cast - state can be null when loopConfig is not provided
                    patterns: () => [],
                    reset: () => { },
                    getRepeatCount: () => 0,
                },
            };
        }
        return middlewareContext;
    }
    finally {
        isInitializing = false;
    }
}
export function getMiddlewareContext() {
    return middlewareContext;
}
export function getGlobalMiddlewareChain() {
    return globalMiddlewareChain;
}
export function resetMiddleware() {
    // C-05: Reset global middleware chain hooks to prevent stale hooks on re-init
    globalMiddlewareChain.reset();
    middlewareContext = null;
}
//# sourceMappingURL=middleware-init.js.map