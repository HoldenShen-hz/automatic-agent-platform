/**
 * @fileoverview Runtime Middleware Initialization - Formal execution skeleton.
 *
 * This module initializes the global middleware chain with core middleware
 * like loop detection, and provides utilities for middleware management.
 *
 * All middleware registered here is automatically wired into the global
 * execution chain via globalMiddlewareChain.
 */

import {
  globalMiddlewareChain,
  type AgentMiddlewareChain,
  type BeforeAgentHook,
  type WrapToolCallHook,
} from "./agent-middleware-chain.js";

import {
  createLoopDetectionMiddlewareFull,
  type LoopDetectionState,
  type LoopDetectionConfig,
  type LoopPattern,
} from "./loop-detection.js";
import { createToolArgumentCoercionMiddleware } from "../tool-executor/tool-argument-coercion.js";
import {
  initializeCache,
  createCacheGovernanceMiddleware,
  createCacheSummaryMiddleware,
} from "../../shared/cache/index.js";
import { RuntimeError } from "../../contracts/errors.js";

export interface InitializedMiddlewareContext {
  chain: AgentMiddlewareChain;
  loopDetection: {
    state: LoopDetectionState | null;  // T-18: Allow null when loopConfig is not provided
    patterns: () => LoopPattern[];
    reset: () => void;
    getRepeatCount: (toolName: string, input: unknown) => number;
  };
}

let middlewareContext: InitializedMiddlewareContext | null = null;
// C-02: Track initialization state to prevent concurrent initialization race conditions
let isInitializing = false;

export interface MiddlewareInitOptions {
  loopDetection?: LoopDetectionConfig | null;
  failOpen?: boolean;
}

export function initializeMiddleware(options: MiddlewareInitOptions = {}): InitializedMiddlewareContext {
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
      globalMiddlewareChain.registerWrapToolCall(
        createCacheGovernanceMiddleware({ cache }),
      );
      globalMiddlewareChain.registerAfterAgent(
        createCacheSummaryMiddleware({ cache }),
      );
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
          getRepeatCount: (toolName: string, input: unknown) => state.getRepeatCount(toolName, input),
        },
      };
    } else {
      middlewareContext = {
        chain: globalMiddlewareChain,
        loopDetection: {
          state: null,  // T-18: Removed unsafe cast - state can be null when loopConfig is not provided
          patterns: () => [],
          reset: () => {},
          getRepeatCount: () => 0,
        },
      };
    }

    return middlewareContext;
  } finally {
    isInitializing = false;
  }
}

export function getMiddlewareContext(): InitializedMiddlewareContext | null {
  return middlewareContext;
}

export function getGlobalMiddlewareChain(): AgentMiddlewareChain {
  return globalMiddlewareChain;
}

export function resetMiddleware(): void {
  // C-05: Reset global middleware chain hooks to prevent stale hooks on re-init
  globalMiddlewareChain.reset();
  middlewareContext = null;
}
