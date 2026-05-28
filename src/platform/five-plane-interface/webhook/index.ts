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
  maxConsecutiveFailures?: number;
  signedRequestReplayTtlMs?: number;
  signedRequestReplayCapacity?: number;
  idempotencyTtlMs?: number;
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

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const HEX_SHA256_SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;
const DEFAULT_SIGNED_REQUEST_REPLAY_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_SIGNED_REQUEST_REPLAY_CACHE_ENTRIES = 10_000;
const DEFAULT_MAX_ACCEPTED_ENVELOPES = 10_000;
const DEFAULT_MAX_IDEMPOTENCY_ENTRIES = 10_000;
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_WEBHOOK_PAYLOAD_BYTES = 256 * 1024;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 50;

interface SignedRequestReplayCacheEntry {
  readonly signatureKey: string;
  readonly idempotencyKey: string;
  readonly expiresAtMs: number;
}

interface StoredWebhookEnvelope {
  readonly envelope: WebhookDispatchEnvelope;
  readonly expiresAtMs: number;
}

export interface WebhookIngressServiceOptions {
  maxAcceptedEnvelopes?: number;
  maxIdempotencyEntries?: number;
  idempotencyTtlMs?: number;
  signedRequestReplayTtlMs?: number;
  maxSignedRequestReplayEntries?: number;
  maxPayloadBytes?: number;
  maxConsecutiveFailures?: number;
}

export class WebhookIngressService {
  private readonly endpoints = new Map<string, WebhookEndpointRegistration>();
  private readonly envelopesByIdempotencyKey = new Map<string, StoredWebhookEnvelope>();
  private readonly acceptedEnvelopes: WebhookDispatchEnvelope[] = [];
  private readonly acceptedEnvelopeIndexById = new Map<string, number>();
  private readonly failureCounts = new Map<string, number>();
  private readonly signedRequestReplayCache = new Map<string, SignedRequestReplayCacheEntry>();

  public constructor(private readonly options: WebhookIngressServiceOptions = {}) {}

  public registerEndpoint(input: WebhookEndpointRegistration): WebhookEndpointRegistration {
    assertNonEmpty(input.endpointId, "webhook.invalid_endpoint_id");
    assertNonEmpty(input.source, "webhook.invalid_source");
    if (input.algorithm === "sha256_hmac" && (input.signingSecret == null || input.signingSecret.length === 0)) {
      throw new ValidationError("webhook.signing_secret_required", "webhook.signing_secret_required: Signed webhook endpoints require a signing secret.", {
        details: { endpointId: input.endpointId },
      });
    }
    const maxConsecutiveFailures = normalizePositiveInteger(input.maxConsecutiveFailures);
    const signedRequestReplayTtlMs = normalizePositiveInteger(input.signedRequestReplayTtlMs);
    const signedRequestReplayCapacity = normalizePositiveInteger(input.signedRequestReplayCapacity);
    const idempotencyTtlMs = normalizePositiveInteger(input.idempotencyTtlMs);
    const registration: WebhookEndpointRegistration = {
      ...input,
      tenantId: input.tenantId ?? null,
      workspaceId: input.workspaceId ?? null,
      allowedEventTypes: [...new Set(input.allowedEventTypes)],
      signatureHeader: normalizeHeaderName(input.signatureHeader ?? "x-aa-signature"),
      idempotencyHeader: normalizeHeaderName(input.idempotencyHeader ?? "idempotency-key"),
      dispatchTargetRef: input.dispatchTargetRef ?? null,
      ...(maxConsecutiveFailures != null ? { maxConsecutiveFailures } : {}),
      ...(signedRequestReplayTtlMs != null ? { signedRequestReplayTtlMs } : {}),
      ...(signedRequestReplayCapacity != null ? { signedRequestReplayCapacity } : {}),
      ...(idempotencyTtlMs != null ? { idempotencyTtlMs } : {}),
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

    const nowMs = Date.now();
    this.pruneIdempotencyStore(nowMs);
    pruneSignedRequestReplayCache(this.signedRequestReplayCache, nowMs);

    const payload = parseWebhookPayload(input.body, this.options.maxPayloadBytes ?? DEFAULT_MAX_WEBHOOK_PAYLOAD_BYTES);
    const eventType = readString(payload, "eventType") ?? readString(payload, "event_type") ?? readString(payload, "type");
    if (eventType == null) {
      throw new ValidationError("webhook.event_type_required", "webhook.event_type_required: Webhook payload must include eventType, event_type, or type.");
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
    const signatureVerified = verifySignature({
      endpoint,
      headers: input.headers,
      body: input.body,
      idempotencyKey,
      replayCache: this.signedRequestReplayCache,
      defaultReplayTtlMs: this.options.signedRequestReplayTtlMs ?? DEFAULT_SIGNED_REQUEST_REPLAY_TTL_MS,
      defaultReplayCapacity: this.options.maxSignedRequestReplayEntries ?? DEFAULT_MAX_SIGNED_REQUEST_REPLAY_CACHE_ENTRIES,
    });
    if (endpoint.allowedEventTypes.length > 0 && !endpoint.allowedEventTypes.includes(eventType)) {
      throw new ValidationError("webhook.event_type_not_allowed", "webhook.event_type_not_allowed: Webhook event type is not allowed for this endpoint.", {
        details: { endpointId: input.endpointId, eventType, allowedEventTypes: endpoint.allowedEventTypes },
      });
    }

    const scopedIdempotencyKey = `${endpoint.endpointId}:${idempotencyKey}`;
    const existing = this.envelopesByIdempotencyKey.get(scopedIdempotencyKey);
    if (existing != null && existing.expiresAtMs > nowMs) {
      return { ...existing.envelope, dispatchState: "duplicate" };
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
    this.envelopesByIdempotencyKey.set(scopedIdempotencyKey, {
      envelope,
      expiresAtMs: nowMs + resolveIdempotencyTtlMs(endpoint, this.options),
    });
    this.enforceIdempotencyCapacity();
    this.acceptedEnvelopes.push(envelope);
    this.acceptedEnvelopeIndexById.set(envelope.envelopeId, this.acceptedEnvelopes.length - 1);
    this.enforceAcceptedEnvelopeCapacity();
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
    if (existing?.envelope.envelopeId !== envelopeId) {
      return;
    }
    this.envelopesByIdempotencyKey.delete(scopedIdempotencyKey);
    const acceptedIndex = this.acceptedEnvelopeIndexById.get(envelopeId) ?? -1;
    if (acceptedIndex >= 0) {
      this.acceptedEnvelopes.splice(acceptedIndex, 1);
      this.rebuildAcceptedEnvelopeIndex();
    }
  }

  public getEndpoint(endpointId: string): WebhookEndpointRegistration | null {
    return this.endpoints.get(endpointId) ?? null;
  }

  public deleteEndpoint(endpointId: string): boolean {
    this.failureCounts.delete(endpointId);
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
    const threshold = endpoint.maxConsecutiveFailures ?? this.options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
    const updatedEndpoint = nextFailures >= threshold
      ? { ...endpoint, enabled: false }
      : endpoint;
    this.endpoints.set(endpointId, updatedEndpoint);
    return updatedEndpoint;
  }

  public resetFailureCount(endpointId: string): void {
    this.failureCounts.delete(endpointId);
  }

  public reactivateEndpoint(endpointId: string): WebhookEndpointRegistration | null {
    const endpoint = this.endpoints.get(endpointId) ?? null;
    if (endpoint == null) {
      return null;
    }
    const updatedEndpoint = { ...endpoint, enabled: true };
    this.endpoints.set(endpointId, updatedEndpoint);
    this.failureCounts.delete(endpointId);
    return updatedEndpoint;
  }

  public getFailureCount(endpointId: string): number {
    return this.failureCounts.get(endpointId) ?? 0;
  }

  private pruneIdempotencyStore(nowMs: number): void {
    for (const [key, entry] of this.envelopesByIdempotencyKey.entries()) {
      if (entry.expiresAtMs <= nowMs) {
        this.envelopesByIdempotencyKey.delete(key);
      }
    }
  }

  private enforceAcceptedEnvelopeCapacity(): void {
    const maxAcceptedEnvelopes = normalizePositiveInteger(this.options.maxAcceptedEnvelopes) ?? DEFAULT_MAX_ACCEPTED_ENVELOPES;
    while (this.acceptedEnvelopes.length > maxAcceptedEnvelopes) {
      const removed = this.acceptedEnvelopes.shift();
      if (removed != null) {
        this.acceptedEnvelopeIndexById.delete(removed.envelopeId);
      }
    }
    this.rebuildAcceptedEnvelopeIndex();
  }

  private enforceIdempotencyCapacity(): void {
    const maxEntries = normalizePositiveInteger(this.options.maxIdempotencyEntries) ?? DEFAULT_MAX_IDEMPOTENCY_ENTRIES;
    while (this.envelopesByIdempotencyKey.size > maxEntries) {
      const oldestKey = this.envelopesByIdempotencyKey.keys().next().value;
      if (oldestKey == null) {
        return;
      }
      this.envelopesByIdempotencyKey.delete(oldestKey);
    }
  }

  private rebuildAcceptedEnvelopeIndex(): void {
    this.acceptedEnvelopeIndexById.clear();
    for (let index = 0; index < this.acceptedEnvelopes.length; index += 1) {
      this.acceptedEnvelopeIndexById.set(this.acceptedEnvelopes[index]!.envelopeId, index);
    }
  }
}

function verifySignature(input: {
  endpoint: WebhookEndpointRegistration;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  idempotencyKey: string;
  replayCache: Map<string, SignedRequestReplayCacheEntry>;
  defaultReplayTtlMs: number;
  defaultReplayCapacity: number;
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
  if (!HEX_SHA256_SIGNATURE_PATTERN.test(normalizedSignature)) {
    throw new ValidationError("webhook.signature_invalid", "webhook.signature_invalid: Webhook signature verification failed.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
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
    expiresAtMs: nowMs + resolveSignedRequestReplayTtlMs(input.endpoint, input.defaultReplayTtlMs),
  });
  enforceSignedRequestReplayCacheLimit(
    input.replayCache,
    resolveSignedRequestReplayCapacity(input.endpoint, input.defaultReplayCapacity),
  );
  return true;
}

function pruneSignedRequestReplayCache(cache: Map<string, SignedRequestReplayCacheEntry>, nowMs: number): void {
  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      cache.delete(cacheKey);
    }
  }
}

function enforceSignedRequestReplayCacheLimit(cache: Map<string, SignedRequestReplayCacheEntry>, maxEntries: number): void {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey == null) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function parseWebhookPayload(body: string, maxBytes: number): Record<string, unknown> {
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new ValidationError("webhook.payload_too_large", "webhook.payload_too_large: Webhook body exceeds maximum size.", {
      details: { maxBytes },
    });
  }
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

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : undefined;
}

function resolveSignedRequestReplayTtlMs(endpoint: WebhookEndpointRegistration, fallback: number): number {
  return normalizePositiveInteger(endpoint.signedRequestReplayTtlMs) ?? fallback;
}

function resolveSignedRequestReplayCapacity(endpoint: WebhookEndpointRegistration, fallback: number): number {
  return normalizePositiveInteger(endpoint.signedRequestReplayCapacity) ?? fallback;
}

function resolveIdempotencyTtlMs(endpoint: WebhookEndpointRegistration, options: WebhookIngressServiceOptions): number {
  return normalizePositiveInteger(endpoint.idempotencyTtlMs)
    ?? normalizePositiveInteger(options.idempotencyTtlMs)
    ?? DEFAULT_IDEMPOTENCY_TTL_MS;
}
