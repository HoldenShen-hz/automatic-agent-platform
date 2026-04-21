/**
 * @fileoverview OpenAI Chat Service - Chat completion for GPT models
 *
 * ## Overview
 *
 * Provides chat completion functionality using OpenAI's GPT models.
 * Supports GPT-4o, GPT-4, GPT-3.5 Turbo series.
 *
 * ## API Documentation
 *
 * @see {@link https://platform.openai.com/docs/api-reference/chat | OpenAI API Documentation}
 *
 * ## Supported Models
 *
 * - GPT-4o: Latest flagship model with vision and function calling
 * - GPT-4 Turbo: High intelligence, faster than GPT-4
 * - GPT-3.5 Turbo: Fast and cost-effective
 */
import { ProviderCredentialPool, } from "../provider-credential-pool.js";
import { ProviderError } from "../../../contracts/errors.js";
import { parseResetAt, parseRetryAfterMs, shouldRetryWithinPool, } from "../base-chat-provider.js";
import { OPENAI_API_URL } from "../../../control-plane/config-center/provider-defaults.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../../control-plane/iam/network-egress-policy.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class OpenAIAPIError extends Error {
    statusCode;
    statusText;
    type;
    code;
    credentialId;
    retryAfterMs;
    resetAt;
    constructor(options) {
        super(options.message);
        this.name = "OpenAIAPIError";
        this.statusCode = options.statusCode;
        this.statusText = options.statusText;
        this.type = options.type ?? null;
        this.code = options.code ?? null;
        this.credentialId = options.credentialId ?? null;
        this.retryAfterMs = options.retryAfterMs ?? null;
        this.resetAt = options.resetAt ?? null;
    }
}
export class OpenAIChatService {
    baseUrl;
    organization;
    credentialPool;
    ownsCredentialPool;
    fetchImpl;
    disposed = false;
    constructor(config) {
        this.ownsCredentialPool = config.credentialPool == null;
        this.credentialPool =
            config.credentialPool
                ?? new ProviderCredentialPool({
                    provider: "openai",
                    credentials: config.apiKey
                        ? [
                            {
                                credentialId: "openai-default",
                                apiKey: config.apiKey,
                                label: "default",
                            },
                        ]
                        : [],
                });
        const rawFetchImpl = config.fetchImpl ?? fetch;
        this.fetchImpl = createPolicyAwareFetch(rawFetchImpl, { action: "openai ChatCompletion" });
        this.organization = config.organization ?? null;
        this.baseUrl = config.baseUrl ?? OPENAI_API_URL;
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.ownsCredentialPool) {
            this.credentialPool.dispose("provider.openai_service_disposed");
        }
    }
    async postWithCredentialFailover(request, stream) {
        const url = `${this.baseUrl}/v1/chat/completions`;
        const triedCredentialIds = [];
        while (true) {
            const selection = await this.credentialPool.selectCredential({
                excludeCredentialIds: triedCredentialIds,
            });
            if (selection == null) {
                const exhaustion = this.credentialPool.getExhaustion();
                throw new OpenAIAPIError({
                    statusCode: 503,
                    statusText: "Provider Credential Exhausted",
                    message: exhaustion.message,
                });
            }
            triedCredentialIds.push(selection.credentialId);
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${selection.apiKey}`,
            };
            if (this.organization) {
                headers["OpenAI-Organization"] = this.organization;
            }
            const response = await this.fetchImpl(url, {
                method: "POST",
                headers,
                body: JSON.stringify({ ...request, ...(stream ? { stream: true } : {}) }),
            });
            if (response.ok) {
                this.credentialPool.markSuccess(selection.credentialId);
                return { response, selection };
            }
            const retryAfterMs = parseRetryAfterMs(response.headers);
            const resetAt = parseResetAt(response.headers, [
                "x-ratelimit-reset",
                "reset-at",
                "ratelimit-reset",
            ]);
            const errorText = await response.text();
            let errorType;
            let errorCode = null;
            try {
                const errorJson = JSON.parse(errorText);
                errorType = errorJson.type;
                errorCode = errorJson.code ?? null;
            }
            catch (err) {
                logger.log({
                    level: "debug",
                    message: "Skipped malformed JSON in error response parse",
                    data: { error: err instanceof Error ? err.message : String(err) },
                });
            }
            this.credentialPool.markFailure({
                credentialId: selection.credentialId,
                statusCode: response.status,
                errorCode: `provider.http_${response.status}`,
                retryAfterMs,
                resetAt,
            });
            this.credentialPool.releaseCredential({ credentialId: selection.credentialId, leaseId: selection.leaseId }, `provider.http_${response.status}`);
            if (shouldRetryWithinPool(response.status, [402, 429, 500, 502, 503, 529])
                && await this.credentialPool.canFailoverAfter({
                    statusCode: response.status,
                    retryAfterMs,
                    resetAt,
                    excludeCredentialIds: triedCredentialIds,
                })) {
                continue;
            }
            throw new OpenAIAPIError({
                statusCode: response.status,
                statusText: response.statusText,
                message: `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
                type: errorType,
                code: errorCode ?? null,
                credentialId: selection.credentialId,
                retryAfterMs: retryAfterMs ?? null,
                resetAt: resetAt ?? null,
            });
        }
    }
    extractContent(response) {
        if (!response.choices || response.choices.length === 0) {
            return null;
        }
        return response.choices[0]?.message?.content ?? null;
    }
    extractRefusal(response) {
        if (!response.choices || response.choices.length === 0) {
            return null;
        }
        return response.choices[0]?.message?.refusal ?? null;
    }
    extractToolCalls(response) {
        const toolCalls = [];
        if (!response.choices || response.choices.length === 0) {
            return toolCalls;
        }
        const message = response.choices[0]?.message;
        if (message?.tool_calls) {
            for (const tc of message.tool_calls) {
                if (tc.type === "function") {
                    toolCalls.push({
                        id: tc.id,
                        type: "function",
                        function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments,
                        },
                    });
                }
            }
        }
        return toolCalls;
    }
    async createChatCompletion(request) {
        this.assertNotDisposed();
        const { response, selection } = await this.postWithCredentialFailover(request, false);
        try {
            const data = (await response.json());
            if (!data.choices || data.choices.length === 0) {
                throw new OpenAIAPIError({
                    statusCode: response.status,
                    statusText: response.statusText,
                    message: "OpenAI API returned no choices",
                });
            }
            return {
                id: data.id,
                content: this.extractContent(data),
                refusal: this.extractRefusal(data),
                finishReason: data.choices[0]?.finish_reason ?? "stop",
                toolCalls: this.extractToolCalls(data),
                usage: data.usage,
                model: data.model,
                rawResponse: data,
            };
        }
        finally {
            this.credentialPool.releaseCredential({ credentialId: selection.credentialId, leaseId: selection.leaseId }, "provider.request_completed");
        }
    }
    async createStreamingChatCompletion(request, onChunk) {
        this.assertNotDisposed();
        const { response, selection } = await this.postWithCredentialFailover(request, true);
        try {
            if (!response.body) {
                throw new OpenAIAPIError({
                    statusCode: response.status,
                    statusText: response.statusText,
                    message: "OpenAI API returned empty response body for streaming",
                });
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let accumulatedContent = "";
            let accumulatedRefusal = null;
            let finalFinishReason = "stop";
            const accumulatedToolCalls = [];
            let accumulatedUsage = null;
            let firstChunk = true;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() ?? "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith("data: ")) {
                            continue;
                        }
                        const data = trimmed.slice(6);
                        if (data === "[DONE]") {
                            onChunk({
                                id: "stream-final",
                                content: accumulatedContent,
                                refusal: accumulatedRefusal,
                                finishReason: finalFinishReason,
                                toolCalls: accumulatedToolCalls,
                                usage: accumulatedUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                                model: request.model,
                                rawResponse: {},
                            }, true);
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices.length > 0) {
                                const choice = parsed.choices[0];
                                if (choice.delta !== undefined) {
                                    // Streaming chunk
                                    if (firstChunk) {
                                        firstChunk = false;
                                        finalFinishReason = choice.finish_reason ?? "stop";
                                    }
                                    if (choice.delta.content) {
                                        accumulatedContent += choice.delta.content;
                                    }
                                    if (choice.delta.refusal) {
                                        accumulatedRefusal = choice.delta.refusal;
                                    }
                                    if (choice.delta.tool_calls) {
                                        for (const tc of choice.delta.tool_calls) {
                                            if (tc.type === "function") {
                                                // Find or create tool call
                                                const existingIdx = accumulatedToolCalls.findIndex((t) => t.id === tc.id);
                                                if (existingIdx >= 0) {
                                                    const existing = accumulatedToolCalls[existingIdx];
                                                    if (existing) {
                                                        existing.function.arguments += tc.function.arguments ?? "";
                                                    }
                                                }
                                                else {
                                                    accumulatedToolCalls.push({
                                                        id: tc.id,
                                                        type: "function",
                                                        function: {
                                                            name: tc.function.name,
                                                            arguments: tc.function.arguments ?? "",
                                                        },
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                                else {
                                    // Final chunk
                                    finalFinishReason = choice.finish_reason ?? "stop";
                                    if (choice.message?.content) {
                                        accumulatedContent = choice.message.content;
                                    }
                                    if (choice.message?.refusal) {
                                        accumulatedRefusal = choice.message.refusal;
                                    }
                                    accumulatedUsage = parsed.usage;
                                }
                                if (parsed.usage) {
                                    accumulatedUsage = parsed.usage;
                                }
                            }
                        }
                        catch (err) {
                            logger.log({
                                level: "debug",
                                message: "Skipped malformed JSON in stream",
                                data: { error: err instanceof Error ? err.message : String(err) },
                            });
                        }
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
            // Send final chunk if we exited loop without [DONE]
            onChunk({
                id: "stream-final",
                content: accumulatedContent,
                refusal: accumulatedRefusal,
                finishReason: finalFinishReason,
                toolCalls: accumulatedToolCalls,
                usage: accumulatedUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                model: request.model,
                rawResponse: {},
            }, true);
        }
        finally {
            this.credentialPool.releaseCredential({ credentialId: selection.credentialId, leaseId: selection.leaseId }, "provider.stream_completed");
        }
    }
    assertNotDisposed() {
        if (this.disposed) {
            throw new ProviderError("provider.disposed", "OpenAI chat service has been disposed.", {
                source: "provider",
                retryable: false,
            });
        }
    }
}
export function createOpenAIChatService(apiKey, options) {
    const config = { apiKey };
    if (options?.baseUrl != null) {
        config.baseUrl = options.baseUrl;
    }
    if (options?.organization != null) {
        config.organization = options.organization;
    }
    return new OpenAIChatService(config);
}
export function createOpenAIChatServiceFromEnvironment(config = {}) {
    const providerEnv = config.providerEnv ?? process.env;
    const serviceConfig = {
        credentialPool: ProviderCredentialPool.fromEnvironment("openai", providerEnv, config.defaultCooldownMs, {
            secretResolver: config.secretResolver ?? null,
            secretLeaseIssuer: config.secretLeaseIssuer ?? null,
            secretLeaseRevoker: config.secretLeaseRevoker ?? null,
        }),
    };
    if (config.baseUrl != null) {
        serviceConfig.baseUrl = config.baseUrl;
    }
    if (config.organization != null) {
        serviceConfig.organization = config.organization;
    }
    if (config.fetchImpl != null) {
        serviceConfig.fetchImpl = config.fetchImpl;
    }
    return new OpenAIChatService(serviceConfig);
}
//# sourceMappingURL=openai-chat-service.js.map