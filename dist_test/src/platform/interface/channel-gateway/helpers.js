import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ValidationError } from "../../contracts/errors.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export function parseMetadata(raw) {
    if (raw == null) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed != null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
    catch (err) {
        logger.warn("parseMetadata failed", { error: err });
        return {};
    }
}
export function requireNonEmpty(value, code) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new ValidationError(code, code, {
            retryable: false,
        });
    }
    return normalized;
}
export function readTrackedDeliveryPayload(payload) {
    if (typeof payload.targetId !== "string" || payload.targetId.trim().length === 0) {
        return null;
    }
    if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
        return null;
    }
    const metadata = payload.metadata;
    if (metadata != null && (typeof metadata !== "object" || Array.isArray(metadata))) {
        return null;
    }
    return {
        targetId: payload.targetId,
        text: payload.text,
        ...(metadata != null ? { metadata: metadata } : {}),
    };
}
//# sourceMappingURL=helpers.js.map