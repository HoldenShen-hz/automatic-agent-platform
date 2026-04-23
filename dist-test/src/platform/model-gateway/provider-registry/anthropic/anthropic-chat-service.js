/**
 * @fileoverview Anthropic Chat Service - Chat completion for Claude models
 *
 * ## Overview
 *
 * Provides chat completion functionality using Anthropic's Claude models.
 * Supports Claude 4 (opus, sonnet, haiku) series.
 *
 * ## API Documentation
 *
 * @see {@link https://docs.anthropic.com/claude/reference | Anthropic API Documentation}
 *
 * ## Supported Models
 *
 * - Claude Opus 4: Best quality for complex tasks
 * - Claude Sonnet 4: Balanced performance
 * - Claude Haiku 3.5: Fast, efficient for classification/summarization
 */
import { ProviderCredentialPool, } from "../provider-credential-pool.js";
import { ProviderError } from "../../../contracts/errors.js";
import { parseResetAt, parseRetryAfterMs, shouldRetryWithinPool, } from "../base-chat-provider.js";
import { ANTHROPIC_API_URL } from "../../../control-plane/config-center/provider-defaults.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../../control-plane/iam/network-egress-policy.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class AnthropicAPIError extends Error {
    statusCode;
    statusText;
    type;
    credentialId;
    retryAfterMs;
    resetAt;
    constructor(options) {
        super(options.message);
        this.name = "AnthropicAPIError";
        this.statusCode = options.statusCode;
        this.statusText = options.statusText;
        this.type = options.type ?? null;
        this.credentialId = options.credentialId ?? null;
        this.retryAfterMs = options.retryAfterMs ?? null;
        this.resetAt = options.resetAt ?? null;
    }
}
export class AnthropicChatService {
    baseUrl;
    credentialPool;
    ownsCredentialPool;
    fetchImpl;
    disposed = false;
    constructor(config) {
        this.ownsCredentialPool = config.credentialPool == null;
        this.credentialPool =
            config.credentialPool
                ?? new ProviderCredentialPool({
                    provider: "anthropic",
                    credentials: config.apiKey
                        ? [
                            {
                                credentialId: "anthropic-default",
                                apiKey: config.apiKey,
                                label: "default",
                            },
                        ]
                        : [],
                });
        const rawFetchImpl = config.fetchImpl ?? fetch;
        this.fetchImpl = createPolicyAwareFetch(rawFetchImpl, { action: "anthropic ChatCompletion" });
        this.baseUrl = config.baseUrl ?? ANTHROPIC_API_URL;
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.ownsCredentialPool) {
            this.credentialPool.dispose("provider.anthropic_service_disposed");
        }
    }
    async postWithCredentialFailover(request, stream) {
        const url = `${this.baseUrl}/v1/messages`;
        const triedCredentialIds = [];
        const ANTHROPIC_VERSION = "2023-06-01";
        while (true) {
            const selection = await this.credentialPool.selectCredential({
                excludeCredentialIds: triedCredentialIds,
            });
            if (selection == null) {
                const exhaustion = this.credentialPool.getExhaustion();
                throw new AnthropicAPIError({
                    statusCode: 503,
                    statusText: "Provider Credential Exhausted",
                    message: exhaustion.message,
                });
            }
            triedCredentialIds.push(selection.credentialId);
            // Transform request to Anthropic format
            const anthropicRequest = this.transformToAnthropicRequest(request);
            const response = await this.fetchImpl(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": selection.apiKey,
                    "anthropic-version": ANTHROPIC_VERSION,
                },
                body: JSON.stringify({ ...anthropicRequest, ...(stream ? { stream: true } : {}) }),
            });
            if (response.ok) {
                this.credentialPool.markSuccess(selection.credentialId);
                return { response, selection };
            }
            const retryAfterMs = parseRetryAfterMs(response.headers);
            const resetAt = parseResetAt(response.headers, [
                "anthropic-ratelimit-reset",
                "x-ratelimit-reset",
                "reset-at",
            ]);
            const errorText = await response.text();
            let errorType;
            try {
                const errorJson = JSON.parse(errorText);
                errorType = errorJson.type;
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
            if (shouldRetryWithinPool(response.status, [429, 500, 502, 503, 529])
                && await this.credentialPool.canFailoverAfter({
                    statusCode: response.status,
                    retryAfterMs,
                    resetAt,
                    excludeCredentialIds: triedCredentialIds,
                })) {
                continue;
            }
            throw new AnthropicAPIError({
                statusCode: response.status,
                statusText: response.statusText,
                message: `Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`,
                ...(errorType !== undefined ? { type: errorType } : {}),
                credentialId: selection.credentialId,
                ...(retryAfterMs !== null ? { retryAfterMs } : {}),
                ...(resetAt !== null ? { resetAt } : {}),
            });
        }
    }
    transformToAnthropicRequest(request) {
        // Extract system message if present
        let systemMessage;
        const anthropicMessages = [];
        for (const msg of request.messages) {
            if (msg.role === "system") {
                systemMessage = msg.content;
            }
            else {
                anthropicMessages.push(msg);
            }
        }
        const result = {
            model: request.model,
            messages: anthropicMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : m.role,
                content: m.content,
            })),
            max_tokens: request.max_tokens,
        };
        if (systemMessage) {
            result.system = systemMessage;
        }
        if (request.temperature !== undefined) {
            result.temperature = request.temperature;
        }
        if (request.top_p !== undefined) {
            result.top_p = request.top_p;
        }
        if (request.tools && request.tools.length > 0) {
            result.tools = request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.input_schema,
            }));
        }
        if (request.tool_choice) {
            result.tool_choice = { type: request.tool_choice };
        }
        return result;
    }
    extractContent(response) {
        const textParts = [];
        for (const block of response.content) {
            if (block.type === "text") {
                textParts.push(block.text ?? "");
            }
        }
        return textParts.join("\n");
    }
    extractRefusal(response) {
        for (const block of response.content) {
            if (block.type === "refusal") {
                return block.text ?? "Refused";
            }
        }
        return null;
    }
    async createChatCompletion(request) {
        this.assertNotDisposed();
        const { response, selection } = await this.postWithCredentialFailover(request, false);
        try {
            const data = (await response.json());
            return {
                id: data.id,
                content: this.extractContent(data),
                refusal: this.extractRefusal(data),
                stopReason: data.stop_reason,
                stopSequence: data.stop_sequence ?? null,
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
                throw new AnthropicAPIError({
                    statusCode: response.status,
                    statusText: response.statusText,
                    message: "Anthropic API returned empty response body for streaming",
                });
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let accumulatedUsage = null;
            let accumulatedContent = "";
            let accumulatedRefusal = null;
            let finalStopReason = null;
            let finalStopSequence = null;
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
                            // Send final chunk
                            onChunk({
                                id: "stream-final",
                                content: accumulatedContent,
                                refusal: accumulatedRefusal,
                                stopReason: finalStopReason ?? "end_turn",
                                stopSequence: finalStopSequence,
                                usage: accumulatedUsage ?? { input_tokens: 0, output_tokens: 0 },
                                model: request.model,
                                rawResponse: {},
                            }, true);
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === "content_block_delta") {
                                if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
                                    accumulatedContent += parsed.delta.text;
                                }
                            }
                            else if (parsed.type === "message_delta") {
                                if (parsed.usage) {
                                    accumulatedUsage = parsed.usage;
                                }
                                if (parsed.delta?.type === "text_delta") {
                                    // already accumulated above
                                }
                            }
                            else if (parsed.type === "message") {
                                // Final message
                                if (parsed.message) {
                                    accumulatedContent = this.extractContent(parsed.message);
                                    accumulatedRefusal = this.extractRefusal(parsed.message);
                                    finalStopReason = parsed.message.stop_reason;
                                    finalStopSequence = parsed.message.stop_sequence ?? null;
                                    accumulatedUsage = parsed.message.usage;
                                }
                            }
                            else if (parsed.type === "content_block_start") {
                                if (parsed.content_block?.type === "refusal") {
                                    accumulatedRefusal = parsed.content_block.refusal ?? "Refused";
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
                stopReason: finalStopReason ?? "end_turn",
                stopSequence: finalStopSequence,
                usage: accumulatedUsage ?? { input_tokens: 0, output_tokens: 0 },
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
            throw new ProviderError("provider.disposed", "Anthropic chat service has been disposed.", {
                source: "provider",
                retryable: false,
            });
        }
    }
}
export function createAnthropicChatService(apiKey, baseUrl) {
    const config = { apiKey };
    if (baseUrl != null) {
        config.baseUrl = baseUrl;
    }
    return new AnthropicChatService(config);
}
export function createAnthropicChatServiceFromEnvironment(config = {}) {
    const providerEnv = config.providerEnv ?? process.env;
    const serviceConfig = {
        credentialPool: ProviderCredentialPool.fromEnvironment("anthropic", providerEnv, config.defaultCooldownMs, {
            secretResolver: config.secretResolver ?? null,
            secretLeaseIssuer: config.secretLeaseIssuer ?? null,
            secretLeaseRevoker: config.secretLeaseRevoker ?? null,
        }),
    };
    if (config.baseUrl != null) {
        serviceConfig.baseUrl = config.baseUrl;
    }
    if (config.fetchImpl != null) {
        serviceConfig.fetchImpl = config.fetchImpl;
    }
    return new AnthropicChatService(serviceConfig);
}
//# sourceMappingURL=anthropic-chat-service.js.map