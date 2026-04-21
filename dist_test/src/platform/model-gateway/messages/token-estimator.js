/**
 * Token Estimator
 *
 * Estimates token counts for text and messages using character-based heuristics.
 * Provides accurate estimation for multiple script types including CJK.
 */
import { parseMessagePartsJson } from "./message-parts.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const tokenEstimatorLogger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Type guard to check if a value is a plain record object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Reads numeric token usage from a payload with various possible key formats.
 */
function readNumericUsage(payload) {
    const directKeys = ["estimatedTokens", "tokenCount", "totalTokens"];
    for (const key of directKeys) {
        const value = payload[key];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    const inputTokens = payload.inputTokens;
    const outputTokens = payload.outputTokens;
    if (typeof inputTokens === "number" &&
        Number.isFinite(inputTokens) &&
        inputTokens >= 0 &&
        typeof outputTokens === "number" &&
        Number.isFinite(outputTokens) &&
        outputTokens >= 0) {
        return inputTokens + outputTokens;
    }
    const nestedUsage = payload.tokenUsage ?? payload.usage;
    if (isRecord(nestedUsage)) {
        return readNumericUsage(nestedUsage);
    }
    return null;
}
/**
 * Estimates token count for raw text content.
 *
 * Uses a character-based approach that handles:
 * - CJK characters (Chinese, Japanese, Korean) at ~1 token per character
 * - English words at ~4 characters per token
 * - Numbers at ~3 characters per token
 * - Symbols and whitespace
 */
export function estimateTextTokens(content) {
    if (content.trim().length === 0) {
        return 1;
    }
    let working = content.replace(/\r\n/g, "\n");
    let tokens = 0;
    // Estimate CJK characters (Chinese, Hiragana, Katakana, Hangul)
    const cjkMatches = working.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
    tokens += cjkMatches.length;
    working = working.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, " ");
    // Estimate English-like words
    const wordMatches = working.match(/[A-Za-z_]+(?:[A-Za-z0-9_./:-]*[A-Za-z0-9_])?/g) ?? [];
    for (const match of wordMatches) {
        tokens += Math.max(1, Math.ceil(match.length / 4));
    }
    working = working.replace(/[A-Za-z_]+(?:[A-Za-z0-9_./:-]*[A-Za-z0-9_])?/g, " ");
    // Estimate numbers
    const numberMatches = working.match(/\d+(?:[.,:_/-]\d+)*/g) ?? [];
    for (const match of numberMatches) {
        tokens += Math.max(1, Math.ceil(match.length / 3));
    }
    working = working.replace(/\d+(?:[.,:_/-]\d+)*/g, " ");
    // Estimate newlines
    const newlineCount = (working.match(/\n/g) ?? []).length;
    tokens += Math.ceil(newlineCount / 2);
    working = working.replace(/\n/g, " ");
    // Estimate remaining symbols
    const symbolCount = working.replace(/\s+/g, "").length;
    tokens += Math.ceil(symbolCount / 2);
    return Math.max(1, tokens);
}
/**
 * Estimates token count for a message.
 *
 * First checks for explicit token usage in message parts, then falls back
 * to text estimation of the content.
 */
export function estimateMessageTokens(message, options = {}) {
    if (!options.trimmed) {
        const parts = parseMessagePartsJson(message.partsJson);
        const explicitUsage = parts.reduce((sum, part) => {
            try {
                const parsed = JSON.parse(part.contentJson);
                if (!isRecord(parsed)) {
                    return sum;
                }
                const usage = readNumericUsage(parsed);
                return usage == null ? sum : sum + usage;
            }
            catch (err) {
                tokenEstimatorLogger.debug("token_estimator: JSON.parse failed for contentJson", { error: err instanceof Error ? err.message : String(err), partId: part.partId });
                return sum;
            }
        }, 0);
        if (explicitUsage > 0) {
            return Math.max(1, Math.ceil(explicitUsage));
        }
    }
    return estimateTextTokens(options.renderedContent ?? message.content);
}
//# sourceMappingURL=token-estimator.js.map