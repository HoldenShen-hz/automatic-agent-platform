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
import { getContext } from "./runtime-context.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { RuntimeError } from "../../contracts/errors.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class AgentMiddlewareChain {
    options;
    // C-04: Use copy-on-write pattern for atomic array updates
    // Array reassignment is atomic in JS, avoiding race conditions in sortedInsert
    _beforeAgentHooks = [];
    _beforeModelHooks = [];
    _afterModelHooks = [];
    _wrapModelCallHooks = [];
    _wrapToolCallHooks = [];
    _afterAgentHooks = [];
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * C-04: Binary insertion using copy-on-write for atomic updates.
     * Creates new sorted array and atomically reassigns reference.
     */
    sortedInsert(hooks, hook) {
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
            }
            else {
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
    reset() {
        this._beforeAgentHooks = [];
        this._beforeModelHooks = [];
        this._afterModelHooks = [];
        this._wrapModelCallHooks = [];
        this._wrapToolCallHooks = [];
        this._afterAgentHooks = [];
    }
    registerBeforeAgent(hook) {
        this._beforeAgentHooks = this.sortedInsert(this._beforeAgentHooks, hook);
    }
    registerBeforeModel(hook) {
        this._beforeModelHooks = this.sortedInsert(this._beforeModelHooks, hook);
    }
    registerAfterModel(hook) {
        this._afterModelHooks = this.sortedInsert(this._afterModelHooks, hook);
    }
    registerWrapModelCall(hook) {
        this._wrapModelCallHooks = this.sortedInsert(this._wrapModelCallHooks, hook);
    }
    registerWrapToolCall(hook) {
        this._wrapToolCallHooks = this.sortedInsert(this._wrapToolCallHooks, hook);
    }
    registerAfterAgent(hook) {
        this._afterAgentHooks = this.sortedInsert(this._afterAgentHooks, hook);
    }
    logWarning(code, message, ctx) {
        this.options.logger?.(code, message, ctx);
    }
    async runHookChain(hooks, ctx, initialInput, transform) {
        let currentInput = initialInput;
        const errors = [];
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
                    currentInput = result.input;
                }
            }
            catch (err) {
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
    async beforeAgent(input, opts = {}) {
        const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
        const { input: outInput, errors } = await this.runHookChain(this._beforeAgentHooks, ctx, input, (hook, inp) => hook.run(ctx, inp));
        return { input: outInput, warnings: errors };
    }
    async beforeModel(input, opts = {}) {
        const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
        const { input: outInput, errors } = await this.runHookChain(this._beforeModelHooks, ctx, input, (hook, inp) => hook.run(ctx, inp));
        return { input: outInput, warnings: errors };
    }
    async afterModel(input, opts = {}) {
        const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
        const { input: outInput, errors } = await this.runHookChain(this._afterModelHooks, ctx, input, (hook, inp) => hook.run(ctx, inp));
        return { response: outInput.response, warnings: errors };
    }
    async wrapModelCall(input, next, opts = {}) {
        const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
        let currentNext = next;
        for (const hook of this._wrapModelCallHooks) {
            const originalNext = currentNext;
            currentNext = async () => hook.run(ctx, input, originalNext);
        }
        const errors = [];
        try {
            const result = await currentNext();
            return { result, warnings: errors };
        }
        catch (err) {
            const errorMsg = `middleware.model_call.error: ${err instanceof Error ? err.message : String(err)}`;
            errors.push(errorMsg);
            if (this.options.failOpen !== false) {
                this.logWarning(errorMsg, "Model call failed, attempting to continue...", ctx);
                throw err;
            }
            throw err;
        }
    }
    async wrapToolCall(input, next, opts = {}) {
        const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
        let currentNext = next;
        for (const hook of this._wrapToolCallHooks) {
            const originalNext = currentNext;
            currentNext = async () => hook.run(ctx, input, originalNext);
        }
        const errors = [];
        try {
            const result = await currentNext();
            return { result, warnings: errors };
        }
        catch (err) {
            const errorMsg = `middleware.tool_call.${input.toolName}.error: ${err instanceof Error ? err.message : String(err)}`;
            errors.push(errorMsg);
            if (this.options.failOpen !== false) {
                this.logWarning(errorMsg, `Tool ${input.toolName} failed, continuing...`, ctx);
                throw err;
            }
            throw err;
        }
    }
    async afterAgent(input, opts = {}) {
        const ctx = opts.ctx ?? this.buildContext(opts.agentRound ?? 0, opts.stepId);
        const { errors } = await this.runHookChain(this._afterAgentHooks, ctx, input, (hook, inp) => hook.run(ctx, inp));
        return { warnings: errors };
    }
    async runAgentRound(options) {
        const { request, history, messages, model, agentRound, stepId, executeModel } = options;
        const allWarnings = [];
        // Build context once and reuse across all 5 stages to avoid repeated nowIso() calls
        const ctx = this.buildContext(agentRound, stepId);
        const agentOpts = { agentRound, ctx };
        if (stepId != null)
            agentOpts.stepId = stepId;
        const beforeAgentResult = await this.beforeAgent({ request, history }, agentOpts);
        allWarnings.push(...beforeAgentResult.warnings);
        const beforeModelResult = await this.beforeModel(model != null ? { messages, model } : { messages }, agentOpts);
        allWarnings.push(...beforeModelResult.warnings);
        const wrappedExecute = async () => {
            const wrappedInput = { messages: beforeModelResult.input.messages };
            if (beforeModelResult.input.model != null) {
                wrappedInput.model = beforeModelResult.input.model;
            }
            const r = await this.wrapModelCall(wrappedInput, executeModel, agentOpts);
            return r.result;
        };
        const modelResult = await wrappedExecute();
        const afterModelResult = await this.afterModel({ messages: beforeModelResult.input.messages, response: modelResult }, agentOpts);
        allWarnings.push(...afterModelResult.warnings);
        const afterAgentResult = await this.afterAgent({ response: modelResult, toolsUsed: [] }, agentOpts);
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
    buildContext(agentRound, stepId) {
        let runtime;
        try {
            runtime = getContext();
        }
        catch (err) {
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
    getRegisteredHooks() {
        return {
            beforeAgent: this._beforeAgentHooks.map((h) => h.name),
            beforeModel: this._beforeModelHooks.map((h) => h.name),
            afterModel: this._afterModelHooks.map((h) => h.name),
            wrapModelCall: this._wrapModelCallHooks.map((h) => h.name),
            wrapToolCall: this._wrapToolCallHooks.map((h) => h.name),
            afterAgent: this._afterAgentHooks.map((h) => h.name),
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
export function createMiddlewareChain(options) {
    return new AgentMiddlewareChain(options);
}
//# sourceMappingURL=agent-middleware-chain.js.map