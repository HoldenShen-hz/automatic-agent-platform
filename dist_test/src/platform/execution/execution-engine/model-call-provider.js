/**
 * @fileoverview Model Call Provider - Real LLM call implementation for agent execution
 *
 * This module provides the actual LLM call implementation that integrates
 * with the middleware chain's wrapModelCall hooks. It uses the unified chat
 * provider to make real API calls to Anthropic, OpenAI, or MiniMax.
 *
 * ## Architecture
 *
 * The model call provider is registered as a wrapModelCall hook in the middleware
 * chain. When executeAgentRound is called, the middleware chain invokes the
 * registered model call provider which makes the actual LLM API call.
 */
import { globalMiddlewareChain } from "./agent-middleware-chain.js";
import { createUnifiedChatProvider } from "../../model-gateway/provider-registry/unified-chat-provider.js";
import { ProviderError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { CallGovernance } from "./call-governance.js";
import { DistributedRateLimiter } from "../../interface/ingress/distributed-rate-limiter.js";
import { readRedisConnectionConfigFromEnv } from "../../shared/utils/redis-client-options.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
let modelCallProviderInstance = null;
export class ModelCallProviderService {
    unifiedProvider;
    defaultModel;
    callGovernance;
    disposed = false;
    constructor(config) {
        const providerConfig = config.providerConfig ?? {};
        const env = process.env;
        const anthropicApiKey = config.anthropicApiKey ?? env.ANTHROPIC_API_KEY;
        if (!providerConfig.anthropic && anthropicApiKey) {
            providerConfig.anthropic = { apiKey: anthropicApiKey };
        }
        const openaiApiKey = config.openaiApiKey ?? env.OPENAI_API_KEY;
        if (!providerConfig.openai && openaiApiKey) {
            providerConfig.openai = { apiKey: openaiApiKey };
        }
        const minimaxApiKey = config.minimaxApiKey ?? env.MINIMAX_API_KEY ?? env.AA_MINIMAX_API_KEY;
        if (!providerConfig.minimax && minimaxApiKey) {
            providerConfig.minimax = {
                apiKey: minimaxApiKey,
                ...(readTrimmedEnvValue(env.MINIMAX_API_BASE) != null
                    ? { baseUrl: readTrimmedEnvValue(env.MINIMAX_API_BASE) }
                    : {}),
            };
        }
        this.unifiedProvider = createUnifiedChatProvider(providerConfig);
        this.defaultModel = config.defaultModel ?? "MiniMax-M2.7";
        this.callGovernance = createModelCallGovernance(config, process.env);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.unifiedProvider.dispose();
    }
    getDefaultModel() {
        return this.defaultModel;
    }
    hasAnthropic() {
        if (this.disposed) {
            return false;
        }
        return this.unifiedProvider.hasProvider("anthropic");
    }
    hasOpenAI() {
        if (this.disposed) {
            return false;
        }
        return this.unifiedProvider.hasProvider("openai");
    }
    hasMinimax() {
        if (this.disposed) {
            return false;
        }
        return this.unifiedProvider.hasProvider("minimax");
    }
    hasAnyProvider() {
        return this.hasAnthropic() || this.hasOpenAI() || this.hasMinimax();
    }
    async createCompletion(request) {
        if (!this.hasAnyProvider()) {
            throw new ProviderError("model_call.no_provider_configured", "No model provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or MINIMAX_API_KEY environment variable", {
                retryable: true,
            });
        }
        const req = {
            model: request.model,
            messages: request.messages,
            maxTokens: request.maxTokens,
            stream: false,
            ...(request.tools !== undefined ? { tools: request.tools } : {}),
        };
        if (request.system !== undefined) {
            req.system = request.system;
        }
        if (request.temperature !== undefined) {
            req.temperature = request.temperature;
        }
        return this.executeGovernedCompletion(buildModelGovernanceKey(request.model), req);
    }
    async createStreamingCompletion(request, onChunk) {
        if (!this.hasAnyProvider()) {
            throw new ProviderError("model_call.no_provider_configured", "No model provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or MINIMAX_API_KEY environment variable", {
                retryable: true,
            });
        }
        const req = {
            model: request.model,
            messages: request.messages,
            maxTokens: request.maxTokens,
            stream: true,
            ...(request.tools !== undefined ? { tools: request.tools } : {}),
        };
        if (request.system !== undefined) {
            req.system = request.system;
        }
        if (request.temperature !== undefined) {
            req.temperature = request.temperature;
        }
        const governanceKey = buildModelGovernanceKey(request.model);
        const executeStreaming = async () => {
            await this.unifiedProvider.createStreamingChatCompletion(req, (chunk) => {
                onChunk(this.normalizeResult(chunk), false);
            });
        };
        if (this.callGovernance == null) {
            await executeStreaming();
            return;
        }
        const result = await this.callGovernance.execute(governanceKey, executeStreaming);
        if (!result.success) {
            throw this.toGovernanceError(governanceKey, result.error?.code ?? "governance.unknown_error", result.error?.message ?? "Model call governance rejected request.", result.error?.retryable ?? true, result.error?.retryAfterMs);
        }
    }
    createMiddlewareHook() {
        const provider = this;
        return {
            name: "model_call_provider",
            priority: 0,
            run: async (_ctx, input, next) => {
                // If no model call provider is configured, fall through to the next handler
                if (!provider.hasAnyProvider()) {
                    return next();
                }
                try {
                    // Transform the middleware input to our request format
                    const messages = input.messages;
                    const model = input.model ?? provider.getDefaultModel();
                    const result = await provider.createCompletion({
                        model,
                        messages,
                        maxTokens: 4096,
                    });
                    // Return the result as a properly typed response
                    // The actual typing is handled by the next() function's return type
                    return result;
                }
                catch (error) {
                    // If the model call fails, log and re-throw
                    logger.log({ level: "error", message: `LLM call failed`, data: { error: error instanceof Error ? error.message : String(error) } });
                    throw error;
                }
            },
        };
    }
    normalizeResult(result) {
        return {
            id: result.id,
            content: result.content,
            refusal: result.refusal,
            reasoningContent: result.reasoningContent,
            finishReason: result.finishReason,
            toolCalls: result.toolCalls,
            usage: result.usage,
            model: result.model,
            provider: result.provider,
        };
    }
    async executeGovernedCompletion(key, request) {
        const call = async () => this.unifiedProvider.createChatCompletion(request);
        if (this.callGovernance == null) {
            return this.normalizeResult(await call());
        }
        const result = await this.callGovernance.execute(key, call);
        if (!result.success || result.data == null) {
            throw this.toGovernanceError(key, result.error?.code ?? "governance.unknown_error", result.error?.message ?? `Model call rejected by governance for ${key}.`, result.error?.retryable ?? true, result.error?.retryAfterMs);
        }
        return this.normalizeResult(result.data);
    }
    toGovernanceError(key, code, message, retryable, retryAfterMs) {
        return new ProviderError(code, message, {
            retryable,
            ...(retryAfterMs != null ? { details: { governanceKey: key, retryAfterMs } } : { details: { governanceKey: key } }),
        });
    }
}
function buildModelGovernanceKey(model) {
    return `model:${model}`;
}
function createModelCallGovernance(config, env) {
    const callRateLimit = resolveCallRateLimit(config, env);
    const distributedRateLimiter = resolveDistributedRateLimiter(config, env);
    if (callRateLimit == null) {
        return null;
    }
    return new CallGovernance({
        limiter: {
            maxCalls: callRateLimit.maxCalls,
            windowMs: callRateLimit.windowMs,
        },
    }, {
        distributedRateLimiter,
    });
}
function resolveCallRateLimit(config, env) {
    if (config.callRateLimit != null) {
        return config.callRateLimit;
    }
    const maxCalls = parsePositiveInteger(env.AA_MODEL_CALL_RATE_LIMIT_MAX_CALLS);
    const windowMs = parsePositiveInteger(env.AA_MODEL_CALL_RATE_LIMIT_WINDOW_MS);
    if (maxCalls == null && windowMs == null) {
        return null;
    }
    return {
        maxCalls: maxCalls ?? 100,
        windowMs: windowMs ?? 1000,
    };
}
function resolveDistributedRateLimiter(config, env) {
    if (config.distributedRateLimiter != null) {
        return config.distributedRateLimiter;
    }
    const redisConfig = readRedisConnectionConfigFromEnv("AA_MODEL_CALL_RATE_LIMIT_REDIS", env);
    if (redisConfig == null) {
        return null;
    }
    return new DistributedRateLimiter({
        redis: {
            ...redisConfig,
            ...(readTrimmedEnvValue(env.AA_MODEL_CALL_RATE_LIMIT_REDIS_KEY_PREFIX) != null
                ? { keyPrefix: readTrimmedEnvValue(env.AA_MODEL_CALL_RATE_LIMIT_REDIS_KEY_PREFIX) }
                : {}),
        },
    });
}
function readTrimmedEnvValue(raw) {
    if (raw == null) {
        return null;
    }
    const value = raw.trim();
    return value.length > 0 ? value : null;
}
function parsePositiveInteger(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function parseNonNegativeInteger(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
function parseBoolean(raw) {
    const value = readTrimmedEnvValue(raw);
    if (value == null) {
        return null;
    }
    const normalized = value.toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return null;
}
export function initializeModelCallProvider(config) {
    if (modelCallProviderInstance !== null) {
        return modelCallProviderInstance;
    }
    modelCallProviderInstance = new ModelCallProviderService(config);
    // Register the model call hook in the global middleware chain
    const hook = modelCallProviderInstance.createMiddlewareHook();
    const registeredHooks = globalMiddlewareChain.getRegisteredHooks();
    if (!registeredHooks.wrapModelCall.includes(hook.name)) {
        globalMiddlewareChain.registerWrapModelCall(hook);
    }
    return modelCallProviderInstance;
}
export function getModelCallProvider() {
    return modelCallProviderInstance;
}
export function resetModelCallProvider() {
    modelCallProviderInstance?.dispose();
    modelCallProviderInstance = null;
}
export function createModelCallMiddleware(config) {
    const provider = new ModelCallProviderService(config);
    return provider.createMiddlewareHook();
}
//# sourceMappingURL=model-call-provider.js.map