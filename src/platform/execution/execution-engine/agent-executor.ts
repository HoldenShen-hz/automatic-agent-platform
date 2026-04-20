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

import { nowIso } from "../../contracts/types/ids.js";
import {
  globalMiddlewareChain,
  type AgentMiddlewareChain,
  type BeforeAgentHook,
  type BeforeModelHook,
  type AfterModelHook,
  type WrapModelCallHook,
  type WrapToolCallHook,
  type AfterAgentHook,
  type MiddlewareContext,
  type MiddlewareResult,
} from "./agent-middleware-chain.js";

import {
  createLoopDetectionMiddlewareFull,
  type LoopDetectionState,
  type LoopDetectionConfig,
  type LoopPattern,
} from "./loop-detection.js";
import { createToolArgumentCoercionMiddleware } from "../tool-executor/tool-argument-coercion.js";
import { CacheOrchestrationService } from "../../shared/cache/cache-orchestration-service.js";
import {
  initializeCache,
  createCacheGovernanceMiddleware,
  createCacheSummaryMiddleware,
} from "../../shared/cache/index.js";
import { PromptPartitionCacheService, type PromptPartitionUsage } from "./prompt-partition-cache.js";
import { RuntimeError } from "../../contracts/errors.js";

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
    state: LoopDetectionState | null;  // T-17: Allow null when loopConfig is not provided
    patterns: () => LoopPattern[];
    reset: () => void;
    getRepeatCount: (toolName: string, input: unknown) => number;
  };
}

let executorContext: InitializedAgentExecutorContext | null = null;
// C-01: Track initialization state to prevent concurrent initialization race conditions
let isInitializing = false;
const promptPartitionCacheService = new PromptPartitionCacheService();
const cacheOrchestrationService = new CacheOrchestrationService();

export function initializeAgentExecutor(options: AgentExecutorOptions = {}): InitializedAgentExecutorContext {
  if (executorContext !== null) {
    return executorContext;
  }

  // C-01: If initialization is in progress, throw to prevent race condition
  if (isInitializing) {
    throw new RuntimeError("gateway.initialization_in_progress", "Agent executor initialization is already in progress", {
      retryable: false,
    });
  }

  // C-01: Set flag synchronously before starting initialization
  isInitializing = true;

  try {
    const { loopDetection: loopConfig = {}, failOpen = true, logger } = options;

    const chain = globalMiddlewareChain;
    const registeredHooks = chain.getRegisteredHooks();
    if (!registeredHooks.wrapToolCall.includes("tool_argument_coercion")) {
      chain.registerWrapToolCall(createToolArgumentCoercionMiddleware());
    }
    if (!registeredHooks.wrapToolCall.includes("cache-governance")) {
      const cache = initializeCache();
      chain.registerWrapToolCall(createCacheGovernanceMiddleware({ cache }));
      chain.registerAfterAgent(createCacheSummaryMiddleware({ cache }));
    }

    if (logger) {
      const chainAny = chain as unknown as { options: { logger?: (code: string, msg: string, ctx: MiddlewareContext) => void; failOpen?: boolean } };
      const originalLogger = chainAny.options?.logger;
      chainAny.options = {
        failOpen,
        logger: (code: string, msg: string, ctx: MiddlewareContext) => {
          logger(code, msg, ctx);
          originalLogger?.(code, msg, ctx);
        },
      };
    }

    let loopState: LoopDetectionState | null = null;

    if (loopConfig !== null) {
      const { beforeAgent, wrapToolCall, state } = createLoopDetectionMiddlewareFull(loopConfig);

      const latestHooks = chain.getRegisteredHooks();
      if (!latestHooks.beforeAgent.includes(beforeAgent.name)) {
        chain.registerBeforeAgent(beforeAgent);
      }
      if (!latestHooks.wrapToolCall.includes(wrapToolCall.name)) {
        chain.registerWrapToolCall(wrapToolCall);
      }

      loopState = state;
    }

    executorContext = {
      chain,
      loopDetection: {
        state: loopState,  // T-17: Removed unsafe cast - state can be null
        patterns: () => loopState?.getPatterns() ?? [],
        reset: () => loopState?.reset(),
        getRepeatCount: (toolName: string, input: unknown) => loopState?.getRepeatCount(toolName, input) ?? 0,
      },
    };

    return executorContext;
  } finally {
    isInitializing = false;
  }
}

export function getAgentExecutorContext(): InitializedAgentExecutorContext | null {
  return executorContext;
}

export function getGlobalAgentMiddlewareChain(): AgentMiddlewareChain {
  return globalMiddlewareChain;
}

function buildMiddlewareContext(context: AgentExecutorContext): MiddlewareContext {
  return {
    runtime: {
      traceId: context.traceId,
      taskId: context.taskId,
      executionId: context.executionId,
    },
    chainStartedAt: nowIso(),
    agentRound: context.agentRound,
    stepId: context.stepId ?? null,
    executionId: context.executionId,
    taskId: context.taskId,
  };
}

export class AgentExecutor {
  private readonly chain: AgentMiddlewareChain;
  private readonly loopState: LoopDetectionState | null;
  private readonly loopPatterns: () => LoopPattern[];
  private agentRound: number = 0;

  constructor(options: AgentExecutorOptions = {}) {
    const ctx = initializeAgentExecutor(options);
    this.chain = ctx.chain;
    this.loopState = ctx.loopDetection.state;
    this.loopPatterns = ctx.loopDetection.patterns;
  }

  getRegisteredHooks(): ReturnType<AgentMiddlewareChain["getRegisteredHooks"]> {
    return this.chain.getRegisteredHooks();
  }

  getLoopDetectionPatterns(): LoopPattern[] {
    return this.loopPatterns();
  }

  resetLoopDetection(): void {
    this.loopState?.reset();
  }

  async executeAgentRound(
    input: AgentExecutorInput,
    executeModel: () => Promise<unknown>,
  ): Promise<AgentExecutorResult> {
    const ctx = buildMiddlewareContext({
      ...input.context,
      agentRound: this.agentRound,
    });

    const runAgentRoundInput: {
      request: string;
      history: unknown[];
      messages: unknown[];
      model?: string;
      agentRound: number;
      stepId?: string;
      executeModel: () => Promise<unknown>;
    } = {
      request: input.request,
      history: input.history,
      messages: input.messages,
      agentRound: this.agentRound,
      executeModel: async () => executeModel(),
    };
    if (input.model !== undefined) {
      runAgentRoundInput.model = input.model;
    }
    if (input.context.stepId !== undefined) {
      runAgentRoundInput.stepId = input.context.stepId;
    }

    const result = await this.chain.runAgentRound(runAgentRoundInput);
    const promptCache = promptPartitionCacheService.record({
      model: input.model ?? null,
      profileId: null,
      messages: input.messages as Array<{ role?: string | null; content?: unknown; parts?: unknown }>,
    });
    await cacheOrchestrationService.recordPromptPartition({
      model: input.model ?? null,
      profileId: null,
      messages: input.messages as Array<{ role?: string | null; content?: unknown; parts?: unknown }>,
    });

    this.agentRound++;

    const escalatedPatterns = this.loopPatterns().filter((p) => p.escalated);

    const returnValue: AgentExecutorResult = {
      response: result.result,
      warnings: result.warnings,
      beforeAgentWarnings: result.beforeAgentWarnings,
      beforeModelWarnings: result.beforeModelWarnings,
      afterModelWarnings: result.afterModelWarnings,
      afterAgentWarnings: result.afterAgentWarnings,
      promptCache,
    };

    if (this.loopState) {
      returnValue.loopDetection = {
        patterns: this.loopPatterns(),
        escalated: escalatedPatterns.length > 0,
      };
    }

    return returnValue;
  }

  async wrapToolCall<T>(
    toolName: string,
    args: Record<string, unknown>,
    next: () => Promise<T>,
  ): Promise<{ result: T; warnings: string[] }> {
    return this.chain.wrapToolCall(
      { toolName, args },
      next,
      { agentRound: this.agentRound },
    );
  }
}

export function createAgentExecutor(options?: AgentExecutorOptions): AgentExecutor {
  return new AgentExecutor(options);
}
