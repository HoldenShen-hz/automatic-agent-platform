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

import { nowIso } from "../../contracts/types/ids.js";
import { getContext, type RuntimeContextSnapshot } from "./runtime-context.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { RuntimeError } from "../../contracts/errors.js";
import type {
  AfterAgentHook,
  AfterModelHook,
  BeforeAgentHook,
  BeforeModelHook,
  MiddlewareContext,
  MiddlewareHook,
  MiddlewareResult,
  OnFailedHook,
  OnFailedPayload,
  OnSucceededHook,
  OnSucceededPayload,
  WrapModelCallHook,
  WrapToolCallHook,
} from "./agent-middleware-types.js";

export type {
  AfterAgentHook,
  AfterModelHook,
  BeforeAgentHook,
  BeforeModelHook,
  MiddlewareContext,
  MiddlewareHook,
  MiddlewareResult,
  OnFailedHook,
  OnFailedPayload,
  OnSucceededHook,
  OnSucceededPayload,
  WrapModelCallHook,
  WrapToolCallHook,
} from "./agent-middleware-types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export class AgentMiddlewareChain {
  // C-04: Use copy-on-write pattern for atomic array updates
  // Array reassignment is atomic in JS, avoiding race conditions in sortedInsert
  private _beforeAgentHooks: BeforeAgentHook[] = [];
  private _beforeModelHooks: BeforeModelHook[] = [];
  private _afterModelHooks: AfterModelHook[] = [];
  private _wrapModelCallHooks: WrapModelCallHook[] = [];
  private _wrapToolCallHooks: WrapToolCallHook[] = [];
  private _afterAgentHooks: AfterAgentHook[] = [];
  private _onSucceededHooks: OnSucceededHook[] = [];
  private _onFailedHooks: OnFailedHook[] = [];

  constructor(
    private readonly options: {
      failOpen?: boolean;
      logger?: (code: string, msg: string, ctx: MiddlewareContext) => void;
    } = {},
  ) {}

  /**
   * C-04: Binary insertion using copy-on-write for atomic updates.
   * Creates new sorted array and atomically reassigns reference.
   */
  private sortedInsert<T extends MiddlewareHook>(hooks: T[], hook: T): T[] {
    const priority = hook.priority;
    const newHooks = [...hooks];
    let lo = 0;
    let hi = newHooks.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const midHook = newHooks[mid];
      const midPriority = midHook?.priority ?? 0;
      if (midPriority < priority) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    newHooks.splice(lo, 0, hook);
    return newHooks;
  }

  /**
   * C-05: Reset all hooks - clears the middleware chain state.
   * Called by resetMiddleware() to ensure clean state on re-initialization.
   */
  reset(): void {
    this._beforeAgentHooks = [];
    this._beforeModelHooks = [];
    this._afterModelHooks = [];
    this._wrapModelCallHooks = [];
    this._wrapToolCallHooks = [];
    this._afterAgentHooks = [];
    this._onSucceededHooks = [];
    this._onFailedHooks = [];
  }

  registerBeforeAgent(hook: BeforeAgentHook): void {
    this._beforeAgentHooks = this.sortedInsert(this._beforeAgentHooks, hook);
  }

  registerBeforeModel(hook: BeforeModelHook): void {
    this._beforeModelHooks = this.sortedInsert(this._beforeModelHooks, hook);
  }

  registerAfterModel(hook: AfterModelHook): void {
    this._afterModelHooks = this.sortedInsert(this._afterModelHooks, hook);
  }

  registerWrapModelCall(hook: WrapModelCallHook): void {
    this._wrapModelCallHooks = this.sortedInsert(this._wrapModelCallHooks, hook);
  }

  registerWrapToolCall(hook: WrapToolCallHook): void {
    this._wrapToolCallHooks = this.sortedInsert(this._wrapToolCallHooks, hook);
  }

  registerAfterAgent(hook: AfterAgentHook): void {
    this._afterAgentHooks = this.sortedInsert(this._afterAgentHooks, hook);
  }

  registerOnSucceeded(hook: OnSucceededHook): void {
    this._onSucceededHooks = this.sortedInsert(this._onSucceededHooks, hook);
  }

  registerOnFailed(hook: OnFailedHook): void {
    this._onFailedHooks = this.sortedInsert(this._onFailedHooks, hook);
  }

  async triggerOnSucceeded(payload: OnSucceededPayload): Promise<void> {
    await this.runLifecycleHooks(this._onSucceededHooks, payload);
  }

  async triggerOnFailed(payload: OnFailedPayload): Promise<void> {
    await this.runLifecycleHooks(this._onFailedHooks, payload);
  }

  private async runLifecycleHooks<TPayload>(
    hooks: readonly (MiddlewareHook & { run(payload: TPayload): void | Promise<void> })[],
    payload: TPayload,
  ): Promise<void> {
    const orderedHooks = [...hooks].sort((left, right) => right.priority - left.priority);
    for (const hook of orderedHooks) {
      try {
        await hook.run(payload);
      } catch (err) {
        if (this.options.failOpen === false) {
          throw err;
        }
      }
    }
  }

  private logWarning(code: string, message: string, ctx: MiddlewareContext): void {
    this.options.logger?.(code, message, ctx);
  }

  private async runHookChain<T>(
    hooks: MiddlewareHook[],
    ctx: MiddlewareContext,
    initialInput: T,
    transform: (hook: MiddlewareHook, input: T) => MiddlewareResult | Promise<MiddlewareResult>,
  ): Promise<{ input: T; errors: string[] }> {
    let currentInput = initialInput;
    const errors: string[] = [];

    for (const hook of hooks) {
      try {
        const result = await transform(hook, currentInput);
        if (!result.success) {
          const errorMsg = `middleware.${hook.name}.failed: ${result.error?.message ?? "unknown"}`;
          errors.push(errorMsg);
          if (this.options.failOpen !== false) {
            this.logWarning(errorMsg, `Middleware ${hook.name} failed, continuing...`, ctx);
            continue;
          }
          throw new RuntimeError(`middleware.${hook.name}.failed`, result.error?.message ?? "Middleware failed", {
            details: { hook: hook.name, errorMessage: result.error?.message },
          });
        }
        if (result.input !== undefined) {
          currentInput = result.input as T;
        }
      } catch (err) {
        const errorMsg = `middleware.${hook.name}.error: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        if (this.options.failOpen !== false) {
          this.logWarning(errorMsg, `Middleware ${hook.name} threw, continuing...`, ctx);
          continue;
        }
        throw err;
      }
    }

    return { input: currentInput, errors };
  }

  async beforeAgent(
    input: { request: string; history: unknown[] },
    opts: { agentRound?: number; stepId?: string; ctx?: MiddlewareContext } = {},
  ): Promise<{ input: { request: string; history: unknown[] }; warnings: string[] }> {
    const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
    const { input: outInput, errors } = await this.runHookChain(
      this._beforeAgentHooks,
      ctx,
      input,
      (hook, inp) => (hook as BeforeAgentHook).run(ctx, inp),
    );
    return { input: outInput, warnings: errors };
  }

  async beforeModel(
    input: { messages: unknown[]; model?: string },
    opts: { agentRound?: number; stepId?: string; ctx?: MiddlewareContext } = {},
  ): Promise<{ input: { messages: unknown[]; model?: string }; warnings: string[] }> {
    const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
    const { input: outInput, errors } = await this.runHookChain(
      this._beforeModelHooks,
      ctx,
      input,
      (hook, inp) => (hook as BeforeModelHook).run(ctx, inp),
    );
    return { input: outInput, warnings: errors };
  }

  async afterModel(
    input: { messages: unknown[]; response: unknown },
    opts: { agentRound?: number; stepId?: string; ctx?: MiddlewareContext } = {},
  ): Promise<{ response: unknown; warnings: string[] }> {
    const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
    const { input: outInput, errors } = await this.runHookChain(
      this._afterModelHooks,
      ctx,
      input,
      (hook, inp) => (hook as AfterModelHook).run(ctx, inp),
    );
    return { response: (outInput as { messages: unknown[]; response: unknown }).response, warnings: errors };
  }

  async wrapModelCall<T>(
    input: { messages: unknown[]; model?: string },
    next: () => Promise<T>,
    opts: { agentRound?: number; stepId?: string; ctx?: MiddlewareContext } = {},
  ): Promise<{ result: T; warnings: string[] }> {
    const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
    let currentNext = next;

    for (const hook of this._wrapModelCallHooks) {
      const originalNext = currentNext;
      currentNext = async () => (hook as WrapModelCallHook).run(ctx, input, originalNext);
    }

    const errors: string[] = [];
    try {
      const result = await currentNext();
      return { result, warnings: errors };
    } catch (err) {
      const errorMsg = `middleware.model_call.error: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(errorMsg);
      if (this.options.failOpen !== false) {
        this.logWarning(errorMsg, "Model call failed, attempting to continue...", ctx);
        throw err;
      }
      throw err;
    }
  }

  async wrapToolCall<T>(
    input: { toolName: string; args: Record<string, unknown> },
    next: () => Promise<T>,
    opts: { agentRound?: number; stepId?: string; ctx?: MiddlewareContext } = {},
  ): Promise<{ result: T; warnings: string[] }> {
    const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
    let currentNext = next;

    for (const hook of this._wrapToolCallHooks) {
      const originalNext = currentNext;
      currentNext = async () => (hook as WrapToolCallHook).run(ctx, input, originalNext);
    }

    const errors: string[] = [];
    try {
      const result = await currentNext();
      return { result, warnings: errors };
    } catch (err) {
      const errorMsg = `middleware.tool_call.${input.toolName}.error: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(errorMsg);
      if (this.options.failOpen !== false) {
        this.logWarning(errorMsg, `Tool ${input.toolName} failed, continuing...`, ctx);
        throw err;
      }
      throw err;
    }
  }

  async afterAgent(
    input: { response: unknown; toolsUsed: string[] },
    opts: { agentRound?: number; stepId?: string; ctx?: MiddlewareContext } = {},
  ): Promise<{ warnings: string[] }> {
    const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
    const { errors } = await this.runHookChain(
      this._afterAgentHooks,
      ctx,
      input,
      (hook, inp) => (hook as AfterAgentHook).run(ctx, inp),
    );
    return { warnings: errors };
  }

  async runAgentRound<T>(options: {
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
  }> {
    const { request, history, messages, model, agentRound, stepId, executeModel } = options;
    const allWarnings: string[] = [];

    // Build context once and reuse across all 5 stages to avoid repeated nowIso() calls
    const ctx = this.buildContext(agentRound, stepId);
    const agentOpts: { agentRound?: number; stepId?: string; ctx: MiddlewareContext } = { agentRound, ctx };
    if (stepId != null) agentOpts.stepId = stepId;

    const beforeAgentResult = await this.beforeAgent({ request, history }, agentOpts);
    allWarnings.push(...beforeAgentResult.warnings);

    const beforeModelResult = await this.beforeModel(
      model != null ? { messages, model } : { messages },
      agentOpts,
    );
    allWarnings.push(...beforeModelResult.warnings);

    const wrappedExecute = async (): Promise<T> => {
      const wrappedInput: { messages: unknown[]; model?: string } = { messages: beforeModelResult.input.messages };
      if (beforeModelResult.input.model != null) {
        wrappedInput.model = beforeModelResult.input.model;
      }
      const r = await this.wrapModelCall(wrappedInput, executeModel, agentOpts);
      return r.result;
    };

    const modelResult = await wrappedExecute();

    const afterModelResult = await this.afterModel(
      { messages: beforeModelResult.input.messages, response: modelResult },
      agentOpts,
    );
    allWarnings.push(...afterModelResult.warnings);

    const afterAgentResult = await this.afterAgent(
      { response: modelResult, toolsUsed: [] },
      agentOpts,
    );
    allWarnings.push(...afterAgentResult.warnings);

    return {
      result: modelResult,
      warnings: allWarnings,
      beforeAgentWarnings: beforeAgentResult.warnings,
      beforeModelWarnings: beforeModelResult.warnings,
      afterModelWarnings: afterModelResult.warnings,
      afterAgentWarnings: afterAgentResult.warnings,
    };
  }

  private buildContext(agentRound: number, stepId?: string): MiddlewareContext {
    let runtime: RuntimeContextSnapshot;
    try {
      runtime = getContext();
    } catch (err) {
      logger.log({
        level: "warn",
        message: "Failed to get runtime context, using fallback",
        data: { error: err instanceof Error ? err.message : String(err) },
      });
      runtime = {
        traceId: "middleware-no-context",
        taskId: "",
      };
    }

    return {
      runtime,
      chainStartedAt: nowIso(),
      agentRound,
      stepId: stepId ?? null,
      executionId: runtime.executionId ?? null,
      taskId: runtime.taskId ?? "",
    };
  }

  getRegisteredHooks(): {
    beforeAgent: string[];
    beforeModel: string[];
    afterModel: string[];
    wrapModelCall: string[];
    wrapToolCall: string[];
    afterAgent: string[];
    onSucceeded: string[];
    onFailed: string[];
  } {
    return {
      beforeAgent: this._beforeAgentHooks.map((h: BeforeAgentHook) => h.name),
      beforeModel: this._beforeModelHooks.map((h: BeforeModelHook) => h.name),
      afterModel: this._afterModelHooks.map((h: AfterModelHook) => h.name),
      wrapModelCall: this._wrapModelCallHooks.map((h: WrapModelCallHook) => h.name),
      wrapToolCall: this._wrapToolCallHooks.map((h: WrapToolCallHook) => h.name),
      afterAgent: this._afterAgentHooks.map((h: AfterAgentHook) => h.name),
      onSucceeded: this._onSucceededHooks.map((h: OnSucceededHook) => h.name),
      onFailed: this._onFailedHooks.map((h: OnFailedHook) => h.name),
    };
  }
}

const middlewareLogger = new StructuredLogger({ retentionLimit: 100 });
export const globalMiddlewareChain = new AgentMiddlewareChain({
  failOpen: true,
  logger: (code, msg, ctx) => {
    middlewareLogger.log({ level: "warn", message: `[middleware:${code}] ${msg}`, data: { taskId: ctx.taskId ?? "unknown", round: ctx.agentRound } });
  },
});

export function createMiddlewareChain(
  options?: {
    failOpen?: boolean;
    logger?: (code: string, msg: string, ctx: MiddlewareContext) => void;
  },
): AgentMiddlewareChain {
  return new AgentMiddlewareChain(options);
}
