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
  const metadata = payload.metadata;
  if (metadata != null && (typeof metadata !== "object" || Array.isArray(metadata))) {
    return null;
  }
  const requestEnvelope = payload.requestEnvelope;
  if (requestEnvelope != null && (typeof requestEnvelope !== "object" || Array.isArray(requestEnvelope))) {
    return null;
  }
  return {
    targetId: payload.targetId,
    text: payload.text,
    ...(metadata != null ? { metadata: metadata as Record<string, unknown> } : {}),
    ...(requestEnvelope != null ? { requestEnvelope: requestEnvelope as Record<string, unknown> } : {}),
  };
}

export function normalizeWebhookRequestEnvelope(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (metadata == null) {
    return undefined;
  }
  const explicitEnvelope = metadata.requestEnvelope;
  if (explicitEnvelope != null && typeof explicitEnvelope === "object" && !Array.isArray(explicitEnvelope)) {
    return explicitEnvelope as Record<string, unknown>;
  }

  const normalizedEntries = Object.entries(metadata)
    .filter(([key, value]) => key.startsWith("_envelope_") && value != null)
    .map(([key, value]) => [key.slice("_envelope_".length), value] as const);
  if (normalizedEntries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(normalizedEntries);
}
