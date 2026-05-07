import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ValidationError } from "../../contracts/errors.js";
import type { TrackedGatewayDeliveryPayload } from "./types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function parseMetadata(raw: string | null): Record<string, unknown> {
  if (raw == null) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch (err) {
    logger.warn("parseMetadata failed", { error: err });
    return {};
  }
}

export function requireNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(code, code, {
      retryable: false,
    });
  }
  return normalized;
}

export function readTrackedDeliveryPayload(payload: Record<string, unknown>): TrackedGatewayDeliveryPayload | null {
  if (typeof payload.targetId !== "string" || payload.targetId.trim().length === 0) {
    return null;
  }
  if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
    return null;
  }
  const targetId = payload.targetId.trim();
  const text = payload.text.trim();
  const metadata = payload.metadata;
  if (metadata != null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    return null;
  }
  return {
    targetId,
    text,
    ...(metadata != null ? { metadata: metadata as Record<string, unknown> } : {}),
  };
}
