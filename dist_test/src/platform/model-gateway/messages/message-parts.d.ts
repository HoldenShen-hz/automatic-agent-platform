/**
 * Message Parts
 *
 * Manages structured message parts that compose complete messages.
 * Handles part parsing, rendering, and serialization for different
 * message types including tool results, summaries, artifact references,
 * and retry records.
 */
import type { ArtifactRef, MessagePart, MessageRecord } from "../../contracts/types/domain.js";
export type { MessagePart } from "../../contracts/types/domain.js";
/**
 * Options for rendering message parts.
 */
export interface RenderMessagePartsOptions {
    trimToolResultParts?: boolean;
}
/**
 * Result of rendering message parts.
 */
export interface RenderedMessageParts {
    content: string;
    trimmed: boolean;
    trimmedPartCount: number;
}
/**
 * Input for building structured tool result parts.
 */
export interface StructuredToolResultPartsInput {
    messageId: string;
    createdAt: string;
    resultText: string;
    summaryText?: string | null;
    artifactRefs?: ArtifactRef[];
    metadata?: Record<string, unknown>;
}
/**
 * Input for building retry record parts.
 */
export interface RetryRecordPartsInput {
    messageId: string;
    createdAt: string;
    attempt: number;
    nextAttempt?: number | null;
    errorCode: string;
    source: string;
    retryDelayMs?: number | null;
    failureClass?: string | null;
}
/**
 * Builds a simple message part from a message record.
 */
export declare function buildMessageParts(input: Pick<MessageRecord, "id" | "messageType" | "content" | "createdAt">): MessagePart[];
/**
 * Builds structured parts for a tool result including optional summary and artifact references.
 */
export declare function buildStructuredToolResultParts(input: StructuredToolResultPartsInput): MessagePart[];
/**
 * Builds a retry record part documenting a retry attempt.
 */
export declare function buildRetryRecordParts(input: RetryRecordPartsInput): MessagePart[];
/**
 * Parses message parts from JSON, filtering valid parts and sorting by sequence.
 */
export declare function parseMessagePartsJson(partsJson: string | null | undefined): MessagePart[];
/**
 * Renders a single message part as a human-readable string.
 */
export declare function renderMessagePartContent(part: MessagePart): string;
/**
 * Renders message parts for inclusion in context.
 *
 * Parses the parts JSON, renders each part, and optionally trims
 * tool result parts to save context space.
 */
export declare function renderMessagePartsForContext(input: Pick<MessageRecord, "id" | "content" | "partsJson">, options?: RenderMessagePartsOptions): RenderedMessageParts;
/**
 * Serializes message parts to JSON.
 */
export declare function serializeMessageParts(parts: MessagePart[]): string;
/**
 * Ensures a message has parts JSON, building from content if not present.
 */
export declare function ensureMessagePartsJson(input: Pick<MessageRecord, "id" | "messageType" | "content" | "createdAt" | "partsJson">): string;
