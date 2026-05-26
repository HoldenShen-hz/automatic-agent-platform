import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type WebhookSignatureAlgorithm = "none" | "sha256_hmac";

// Zod schema for webhook payload validation
const WebhookPayloadSchema = z.object({
  // eventType can come with different key names
  eventType: z.string().optional(),
  event_type: z.string().optional(),
  type: z.string().optional(),
  // idempotency keys with different naming conventions
  eventId: z.string().optional(),
  event_id: z.string().optional(),
  id: z.string().optional(),
}).passthrough();

export interface WebhookEndpointRegistration {
  endpointId: string;
  source: string;
  tenantId: string | null;
  workspaceId: string | null;
  enabled: boolean;
  allowedEventTypes: string[];
  algorithm: WebhookSignatureAlgorithm;
  signingSecret?: string;
  signatureHeader?: string;
  idempotencyHeader?: string;
  dispatchTargetRef?: string | null;
}

export interface InboundWebhookRequest {
  endpointId: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  receivedAt?: string;
}

export type WebhookDispatchState = "accepted" | "duplicate";

export interface WebhookDispatchEnvelope {
  envelopeId: string;
  endpointId: string;
  source: string;
  tenantId: string | null;
  workspaceId: string | null;
  eventType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  dispatchTargetRef: string | null;
  receivedAt: string;
  acceptedAt: string;
  signatureVerified: boolean;
  dispatchState: WebhookDispatchState;
}

const SIGNED_REQUEST_REPLAY_TTL_MS = 5 * 60 * 1000;
const MAX_SIGNED_REQUEST_REPLAY_CACHE_ENTRIES = 10_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

interface SignedRequestReplayCacheEntry {
  readonly signatureKey: string;
  readonly idempotencyKey: string;
  readonly expiresAtMs: number;
}

export class WebhookIngressService {
  private readonly endpoints = new Map<string, WebhookEndpointRegistration>();
  private readonly envelopesByIdempotencyKey = new Map<string, WebhookDispatchEnvelope>();
  private readonly acceptedEnvelopes: WebhookDispatchEnvelope[] = [];
  private readonly failureCounts = new Map<string, number>();
  private readonly signedRequestReplayCache = new Map<string, SignedRequestReplayCacheEntry>();

  public registerEndpoint(input: WebhookEndpointRegistration): WebhookEndpointRegistration {
    assertNonEmpty(input.endpointId, "webhook.invalid_endpoint_id");
    assertNonEmpty(input.source, "webhook.invalid_source");
    if (input.algorithm === "sha256_hmac" && (input.signingSecret == null || input.signingSecret.length === 0)) {
      throw new ValidationError("webhook.signing_secret_required", "webhook.signing_secret_required: Signed webhook endpoints require a signing secret.", {
        details: { endpointId: input.endpointId },
      });
    }
    const registration: WebhookEndpointRegistration = {
      ...input,
      tenantId: input.tenantId ?? null,
      workspaceId: input.workspaceId ?? null,
      allowedEventTypes: [...new Set(input.allowedEventTypes)],
      signatureHeader: normalizeHeaderName(input.signatureHeader ?? "x-aa-signature"),
      idempotencyHeader: normalizeHeaderName(input.idempotencyHeader ?? "idempotency-key"),
      dispatchTargetRef: input.dispatchTargetRef ?? null,
    };
    this.endpoints.set(registration.endpointId, registration);
    return registration;
  }

  public receive(input: InboundWebhookRequest): WebhookDispatchEnvelope {
    const endpoint = this.endpoints.get(input.endpointId);
    if (endpoint == null) {
      throw new ValidationError("webhook.endpoint_not_found", "webhook.endpoint_not_found: Webhook endpoint is not registered.", {
        details: { endpointId: input.endpointId },
      });
    }
    if (!endpoint.enabled) {
      throw new ValidationError("webhook.endpoint_disabled", "webhook.endpoint_disabled: Webhook endpoint is disabled.", {
        details: { endpointId: input.endpointId },
      });
    }

    const payload = parseWebhookPayload(input.body);
    const eventType = readString(payload, "eventType") ?? readString(payload, "event_type") ?? readString(payload, "type");
    if (eventType == null) {
      throw new ValidationError("webhook.event_type_required", "webhook.event_type_required: Webhook payload must include eventType, event_type, or type.");
    }
    if (endpoint.allowedEventTypes.length > 0 && !endpoint.allowedEventTypes.includes(eventType)) {
      throw new ValidationError("webhook.event_type_not_allowed", "webhook.event_type_not_allowed: Webhook event type is not allowed for this endpoint.", {
        details: { endpointId: input.endpointId, eventType, allowedEventTypes: endpoint.allowedEventTypes },
      });
    }

    const idempotencyKey =
      readHeader(input.headers, endpoint.idempotencyHeader ?? "idempotency-key")
      ?? readString(payload, "eventId")
      ?? readString(payload, "event_id")
      ?? readString(payload, "id");
    if (idempotencyKey == null) {
      throw new ValidationError("webhook.idempotency_key_required", "webhook.idempotency_key_required: Webhook request must include an idempotency key.", {
        details: { endpointId: input.endpointId, eventType },
      });
    }
    assertValidIdempotencyKey(idempotencyKey, input.endpointId, eventType);
    pruneSignedRequestReplayCache(this.signedRequestReplayCache, Date.now());
    const signatureVerified = verifySignature({
      endpoint,
      headers: input.headers,
      body: input.body,
      idempotencyKey,
      replayCache: this.signedRequestReplayCache,
    });

    const scopedIdempotencyKey = `${endpoint.endpointId}:${idempotencyKey}`;
    const existing = this.envelopesByIdempotencyKey.get(scopedIdempotencyKey);
    if (existing != null) {
      return { ...existing, dispatchState: "duplicate" };
    }

    const receivedAt = input.receivedAt ?? nowIso();
    const envelope: WebhookDispatchEnvelope = {
      envelopeId: newId("webhook"),
      endpointId: endpoint.endpointId,
      source: endpoint.source,
      tenantId: endpoint.tenantId,
      workspaceId: endpoint.workspaceId,
      eventType,
      idempotencyKey,
      payload,
      dispatchTargetRef: endpoint.dispatchTargetRef ?? null,
      receivedAt,
      acceptedAt: nowIso(),
      signatureVerified,
      dispatchState: "accepted",
    };
    this.envelopesByIdempotencyKey.set(scopedIdempotencyKey, envelope);
    this.acceptedEnvelopes.push(envelope);
    return envelope;
  }

  public listAcceptedEnvelopes(): WebhookDispatchEnvelope[] {
    return [...this.acceptedEnvelopes];
  }

  public rollbackAcceptedEnvelope(endpointId: string, idempotencyKey: string, envelopeId: string): void {
    const scopedIdempotencyKey = `${endpointId}:${idempotencyKey}`;
    // This method performs no awaits and mutates only in-memory state, so the
    // lookup and delete execute within one event-loop turn.
    const existing = this.envelopesByIdempotencyKey.get(scopedIdempotencyKey);
    if (existing?.envelopeId !== envelopeId) {
      return;
    }
    this.envelopesByIdempotencyKey.delete(scopedIdempotencyKey);
    const acceptedIndex = this.acceptedEnvelopes.findIndex((envelope) => envelope.envelopeId === envelopeId);
    if (acceptedIndex >= 0) {
      this.acceptedEnvelopes.splice(acceptedIndex, 1);
    }
  }

  public getEndpoint(endpointId: string): WebhookEndpointRegistration | null {
    return this.endpoints.get(endpointId) ?? null;
  }

  public deleteEndpoint(endpointId: string): boolean {
    return this.endpoints.delete(endpointId);
  }

  public listEndpoints(): WebhookEndpointRegistration[] {
    return [...this.endpoints.values()];
  }

  public recordDeliveryFailure(endpointId: string): WebhookEndpointRegistration | null {
    const endpoint = this.endpoints.get(endpointId) ?? null;
    if (!endpoint) {
      return null;
    }
    const nextFailures = (this.failureCounts.get(endpointId) ?? 0) + 1;
    this.failureCounts.set(endpointId, nextFailures);
    if (nextFailures >= 50) {
      endpoint.enabled = false;
    }
    return endpoint;
  }

  public resetFailureCount(endpointId: string): void {
    this.failureCounts.delete(endpointId);
  }

  public getFailureCount(endpointId: string): number {
    return this.failureCounts.get(endpointId) ?? 0;
  }
}

function verifySignature(input: {
  endpoint: WebhookEndpointRegistration;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  idempotencyKey: string;
  replayCache: Map<string, SignedRequestReplayCacheEntry>;
}): boolean {
  if (input.endpoint.algorithm === "none") {
    return false;
  }
  const signingSecret = input.endpoint.signingSecret?.trim();
  if (signingSecret == null || signingSecret.length === 0) {
    throw new ValidationError("webhook.signing_secret_required", "webhook.signing_secret_required: Signed webhook endpoints require a signing secret.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  const signature = readHeaderRaw(input.headers, input.endpoint.signatureHeader ?? "x-aa-signature");
  if (signature == null) {
    throw new ValidationError("webhook.signature_required", "webhook.signature_required: Signed webhook request is missing its signature header.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  const trimmedSignature = signature.trim();
  if (trimmedSignature.length === 0) {
    throw new ValidationError("webhook.signature_invalid", "webhook.signature_invalid: Webhook signature verification failed.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  const expected = createHmac("sha256", signingSecret)
    .update(input.body)
    .digest("hex");
  const normalizedSignature = trimmedSignature.startsWith("sha256=") ? trimmedSignature.slice("sha256=".length) : trimmedSignature;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(normalizedSignature, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new ValidationError("webhook.signature_invalid", "webhook.signature_invalid: Webhook signature verification failed.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  const replayCacheKey = `${input.endpoint.endpointId}:${normalizedSignature}`;
  const cachedReplay = input.replayCache.get(replayCacheKey);
  if (cachedReplay != null && cachedReplay.idempotencyKey !== input.idempotencyKey) {
    throw new ValidationError("webhook.signature_replay_detected", "webhook.signature_replay_detected: Webhook signature replay was detected.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  const nowMs = Date.now();
  input.replayCache.set(replayCacheKey, {
    signatureKey: replayCacheKey,
    idempotencyKey: input.idempotencyKey,
    expiresAtMs: nowMs + SIGNED_REQUEST_REPLAY_TTL_MS,
  });
  enforceSignedRequestReplayCacheLimit(input.replayCache);
  return true;
}

function pruneSignedRequestReplayCache(cache: Map<string, SignedRequestReplayCacheEntry>, nowMs: number): void {
  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      cache.delete(cacheKey);
    }
  }
}

function enforceSignedRequestReplayCacheLimit(cache: Map<string, SignedRequestReplayCacheEntry>): void {
  while (cache.size > MAX_SIGNED_REQUEST_REPLAY_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey == null) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function parseWebhookPayload(body: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ValidationError("webhook.invalid_json", "webhook.invalid_json: Webhook body must be a JSON object.", {
        details: { message: "payload must be an object" },
      });
    }
    // Validate payload structure with Zod schema
    const validated = WebhookPayloadSchema.parse(parsed);
    return validated as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError("webhook.invalid_json", "webhook.invalid_json: Webhook body must be a valid JSON object.", {
      details: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = readHeaderRaw(headers, name);
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readHeaderRaw(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const normalized = normalizeHeaderName(name);
  for (const [headerName, value] of Object.entries(headers)) {
    if (normalizeHeaderName(headerName) !== normalized || value == null) {
      continue;
    }
    const first = Array.isArray(value) ? value[0] : value;
    return first ?? null;
  }
  return null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function assertNonEmpty(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, `${code}: Webhook configuration value must be non-empty.`, {
      details: { value },
    });
  }
}

function assertValidIdempotencyKey(idempotencyKey: string, endpointId: string, eventType: string): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new ValidationError(
      "webhook.idempotency_key_invalid",
      "webhook.idempotency_key_invalid: Webhook idempotency key must be 1-256 chars of [A-Za-z0-9._:-].",
      {
        details: {
          endpointId,
          eventType,
          idempotencyKeyLength: idempotencyKey.length,
        },
      },
    );
  }
}
