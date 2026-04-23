/**
 * Token Estimator
 *
 * Estimates token counts for text and messages using character-based heuristics.
 * Provides accurate estimation for multiple script types including CJK.
 */
import type { MessageRecord } from "../../contracts/types/domain.js";
/**
 * Estimates token count for raw text content.
 *
 * Uses a character-based approach that handles:
 * - CJK characters (Chinese, Japanese, Korean) at ~1 token per character
 * - English words at ~4 characters per token
 * - Numbers at ~3 characters per token
 * - Symbols and whitespace
 */
export declare function estimateTextTokens(content: string): number;
/**
 * Estimates token count for a message.
 *
 * First checks for explicit token usage in message parts, then falls back
 * to text estimation of the content.
 */
export declare function estimateMessageTokens(message: Pick<MessageRecord, "content" | "partsJson">, options?: {
    renderedContent?: string;
    trimmed?: boolean;
}): number;
