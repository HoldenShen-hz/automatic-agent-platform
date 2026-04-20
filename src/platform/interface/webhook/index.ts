import { createHmac, timingSafeEqual } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type WebhookSignatureAlgorithm = "none" | "sha256_hmac";

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

export class WebhookIngressService {
  private readonly endpoints = new Map<string, WebhookEndpointRegistration>();
  private readonly envelopesByIdempotencyKey = new Map<string, WebhookDispatchEnvelope>();
  private readonly acceptedEnvelopes: WebhookDispatchEnvelope[] = [];

  public registerEndpoint(input: WebhookEndpointRegistration): WebhookEndpointRegistration {
    assertNonEmpty(input.endpointId, "webhook.invalid_endpoint_id");
    assertNonEmpty(input.source, "webhook.invalid_source");
    if (input.algorithm === "sha256_hmac" && (input.signingSecret == null || input.signingSecret.length === 0)) {
      throw new ValidationError("webhook.signing_secret_required", "Signed webhook endpoints require a signing secret.", {
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
      throw new ValidationError("webhook.endpoint_not_found", "Webhook endpoint is not registered.", {
        details: { endpointId: input.endpointId },
      });
    }
    if (!endpoint.enabled) {
      throw new ValidationError("webhook.endpoint_disabled", "Webhook endpoint is disabled.", {
        details: { endpointId: input.endpointId },
      });
    }

    const payload = parseWebhookPayload(input.body);
    const eventType = readString(payload, "eventType") ?? readString(payload, "event_type") ?? readString(payload, "type");
    if (eventType == null) {
      throw new ValidationError("webhook.event_type_required", "Webhook payload must include eventType, event_type, or type.");
    }
    if (endpoint.allowedEventTypes.length > 0 && !endpoint.allowedEventTypes.includes(eventType)) {
      throw new ValidationError("webhook.event_type_not_allowed", "Webhook event type is not allowed for this endpoint.", {
        details: { endpointId: input.endpointId, eventType, allowedEventTypes: endpoint.allowedEventTypes },
      });
    }

    const signatureVerified = verifySignature({
      endpoint,
      headers: input.headers,
      body: input.body,
    });
    const idempotencyKey =
      readHeader(input.headers, endpoint.idempotencyHeader ?? "idempotency-key")
      ?? readString(payload, "eventId")
      ?? readString(payload, "event_id")
      ?? readString(payload, "id");
    if (idempotencyKey == null) {
      throw new ValidationError("webhook.idempotency_key_required", "Webhook request must include an idempotency key.", {
        details: { endpointId: input.endpointId, eventType },
      });
    }

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

  public getEndpoint(endpointId: string): WebhookEndpointRegistration | null {
    return this.endpoints.get(endpointId) ?? null;
  }

  public deleteEndpoint(endpointId: string): boolean {
    return this.endpoints.delete(endpointId);
  }

  public listEndpoints(): WebhookEndpointRegistration[] {
    return [...this.endpoints.values()];
  }
}

function verifySignature(input: {
  endpoint: WebhookEndpointRegistration;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}): boolean {
  if (input.endpoint.algorithm === "none") {
    return false;
  }
  const signature = readHeader(input.headers, input.endpoint.signatureHeader ?? "x-aa-signature");
  if (signature == null) {
    throw new ValidationError("webhook.signature_required", "Signed webhook request is missing its signature header.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  const expected = createHmac("sha256", input.endpoint.signingSecret ?? "")
    .update(input.body)
    .digest("hex");
  const normalizedSignature = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(normalizedSignature, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new ValidationError("webhook.signature_invalid", "Webhook signature verification failed.", {
      details: { endpointId: input.endpoint.endpointId },
    });
  }
  return true;
}

function parseWebhookPayload(body: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload must be an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new ValidationError("webhook.invalid_json", "Webhook body must be a JSON object.", {
      details: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const normalized = normalizeHeaderName(name);
  for (const [headerName, value] of Object.entries(headers)) {
    if (normalizeHeaderName(headerName) !== normalized || value == null) {
      continue;
    }
    const first = Array.isArray(value) ? value[0] : value;
    const trimmed = first?.trim();
    return trimmed == null || trimmed.length === 0 ? null : trimmed;
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
    throw new ValidationError(code, "Webhook configuration value must be non-empty.", {
      details: { value },
    });
  }
}
