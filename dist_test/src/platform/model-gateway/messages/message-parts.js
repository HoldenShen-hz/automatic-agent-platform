/**
 * Message Parts
 *
 * Manages structured message parts that compose complete messages.
 * Handles part parsing, rendering, and serialization for different
 * message types including tool results, summaries, artifact references,
 * and retry records.
 */
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const messagePartsLogger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Determines the default part type based on message type.
 */
function defaultPartType(messageType) {
    switch (messageType) {
        case "tool_result":
            return "tool_result";
        case "compaction_summary":
            return "summary";
        default:
            return "text";
    }
}
/**
 * Creates the default content payload for a part type.
 */
function defaultContentPayload(partType, content) {
    switch (partType) {
        case "summary":
            return { summary: content };
        case "tool_result":
            return { text: content, structured: false };
        default:
            return { text: content };
    }
}
/**
 * Type guard to check if a value is a plain record object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Reads a string value from a payload object using multiple possible keys.
 */
function readString(payload, keys) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }
    return null;
}
/**
 * Safely parses content JSON, returning null on failure.
 */
function safeParseContentJson(contentJson) {
    try {
        const parsed = JSON.parse(contentJson);
        return isRecord(parsed) ? parsed : null;
    }
    catch (err) {
        messagePartsLogger.debug("message_parts: JSON.parse failed in safeParseContentJson", { error: err instanceof Error ? err.message : String(err) });
        return null;
    }
}
/**
 * Renders an artifact reference payload as a human-readable string.
 */
function renderArtifactRefPayload(payload) {
    const kind = readString(payload, ["kind"]) ?? "artifact";
    const artifactId = readString(payload, ["artifactId", "artifact_id"]) ?? "unknown";
    const uri = readString(payload, ["uri", "path"]);
    return uri == null
        ? `Artifact ref kind=${kind} artifact_id=${artifactId}`
        : `Artifact ref kind=${kind} artifact_id=${artifactId} uri=${uri}`;
}
/**
 * Builds a simple message part from a message record.
 */
export function buildMessageParts(input) {
    const partType = defaultPartType(input.messageType);
    return [
        {
            partId: `${input.id}:part:1`,
            messageId: input.id,
            partType,
            sequence: 1,
            contentJson: JSON.stringify(defaultContentPayload(partType, input.content)),
            lineageJson: null,
            createdAt: input.createdAt,
        },
    ];
}
/**
 * Builds structured parts for a tool result including optional summary and artifact references.
 */
export function buildStructuredToolResultParts(input) {
    const parts = [];
    let sequence = 1;
    if (input.summaryText != null && input.summaryText.trim().length > 0) {
        parts.push({
            partId: `${input.messageId}:part:${sequence}`,
            messageId: input.messageId,
            partType: "summary",
            sequence,
            contentJson: JSON.stringify({ summary: input.summaryText.trim() }),
            lineageJson: null,
            createdAt: input.createdAt,
        });
        sequence += 1;
    }
    for (const artifactRef of input.artifactRefs ?? []) {
        parts.push({
            partId: `${input.messageId}:part:${sequence}`,
            messageId: input.messageId,
            partType: "artifact_ref",
            sequence,
            contentJson: JSON.stringify(artifactRef),
            lineageJson: null,
            createdAt: input.createdAt,
        });
        sequence += 1;
    }
    parts.push({
        partId: `${input.messageId}:part:${sequence}`,
        messageId: input.messageId,
        partType: "tool_result",
        sequence,
        contentJson: JSON.stringify({
            text: input.resultText,
            structured: parts.length > 0,
            ...(input.metadata ?? {}),
        }),
        lineageJson: null,
        createdAt: input.createdAt,
    });
    return parts;
}
/**
 * Builds a retry record part documenting a retry attempt.
 */
export function buildRetryRecordParts(input) {
    return [
        {
            partId: `${input.messageId}:part:1`,
            messageId: input.messageId,
            partType: "retry_record",
            sequence: 1,
            contentJson: JSON.stringify({
                attempt: input.attempt,
                nextAttempt: input.nextAttempt ?? null,
                errorCode: input.errorCode,
                source: input.source,
                retryDelayMs: input.retryDelayMs ?? 0,
                failureClass: input.failureClass ?? null,
            }),
            lineageJson: null,
            createdAt: input.createdAt,
        },
    ];
}
/**
 * Parses message parts from JSON, filtering valid parts and sorting by sequence.
 */
export function parseMessagePartsJson(partsJson) {
    if (typeof partsJson !== "string" || partsJson.trim().length === 0) {
        return [];
    }
    try {
        const parsed = JSON.parse(partsJson);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((part) => {
            return isRecord(part)
                && typeof part.partId === "string"
                && typeof part.messageId === "string"
                && typeof part.partType === "string"
                && typeof part.sequence === "number"
                && typeof part.contentJson === "string"
                && (typeof part.lineageJson === "string" || part.lineageJson === null)
                && typeof part.createdAt === "string";
        })
            .sort((left, right) => left.sequence - right.sequence);
    }
    catch (err) {
        messagePartsLogger.debug("message_parts: JSON.parse failed in parseMessagePartsJson", { error: err instanceof Error ? err.message : String(err), partsJsonLength: partsJson.length });
        return [];
    }
}
/**
 * Renders a single message part as a human-readable string.
 */
export function renderMessagePartContent(part) {
    const payload = safeParseContentJson(part.contentJson);
    if (payload == null) {
        return "";
    }
    switch (part.partType) {
        case "summary":
            return readString(payload, ["summary", "text"]) ?? "";
        case "artifact_ref":
            return renderArtifactRefPayload(payload);
        case "tool_result":
        case "text":
        case "reasoning":
            return readString(payload, ["text", "summary", "result"]) ?? "";
        case "decision_prompt":
            return readString(payload, ["prompt", "reason", "text"]) ?? "";
        case "step_boundary": {
            const stepId = readString(payload, ["stepId", "step_id"]) ?? "unknown";
            const boundaryKind = readString(payload, ["boundaryKind", "boundary_kind"]) ?? "unknown";
            return `Step ${stepId} ${boundaryKind}`;
        }
        case "retry_record": {
            const attempt = payload.attempt;
            const errorCode = readString(payload, ["errorCode", "error_code"]) ?? "unknown";
            return typeof attempt === "number" ? `Retry attempt=${attempt} error=${errorCode}` : `Retry error=${errorCode}`;
        }
        case "command_execution": {
            const commandRef = readString(payload, ["commandRef", "command_ref"]) ?? "unknown";
            const status = readString(payload, ["status"]) ?? "unknown";
            const cwd = readString(payload, ["cwd"]);
            return cwd == null
                ? `Command ${commandRef} status=${status}`
                : `Command ${commandRef} status=${status} cwd=${cwd}`;
        }
        case "mcp_call": {
            const serverName = readString(payload, ["serverName", "server_name"]) ?? "unknown";
            const toolName = readString(payload, ["toolName", "tool_name"]) ?? "unknown";
            const status = readString(payload, ["status"]) ?? "unknown";
            return `MCP ${serverName}/${toolName} status=${status}`;
        }
        default: {
            const text = readString(payload, ["text", "summary", "result", "status"]);
            return text ?? JSON.stringify(payload);
        }
    }
}
/**
 * Renders message parts for inclusion in context.
 *
 * Parses the parts JSON, renders each part, and optionally trims
 * tool result parts to save context space.
 */
export function renderMessagePartsForContext(input, options = {}) {
    const parts = parseMessagePartsJson(input.partsJson);
    if (parts.length === 0) {
        if (options.trimToolResultParts) {
            return {
                content: `Tool result trimmed for context budget. Original message_id=${input.id}.`,
                trimmed: true,
                trimmedPartCount: 1,
            };
        }
        return {
            content: input.content,
            trimmed: false,
            trimmedPartCount: 0,
        };
    }
    const renderedParts = [];
    let trimmedPartCount = 0;
    for (const part of parts) {
        if (options.trimToolResultParts && part.partType === "tool_result") {
            trimmedPartCount += 1;
            continue;
        }
        const rendered = renderMessagePartContent(part);
        if (rendered.length > 0) {
            renderedParts.push(rendered);
        }
    }
    if (trimmedPartCount > 0) {
        renderedParts.push(`Tool result trimmed for context budget. Original message_id=${input.id}.`);
    }
    const content = renderedParts.join(" ").trim();
    return {
        content: content.length > 0 ? content : input.content,
        trimmed: trimmedPartCount > 0,
        trimmedPartCount,
    };
}
/**
 * Serializes message parts to JSON.
 */
export function serializeMessageParts(parts) {
    return JSON.stringify(parts);
}
/**
 * Ensures a message has parts JSON, building from content if not present.
 */
export function ensureMessagePartsJson(input) {
    return input.partsJson ?? serializeMessageParts(buildMessageParts(input));
}
//# sourceMappingURL=message-parts.js.map