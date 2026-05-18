import { createHmac, timingSafeEqual } from "node:crypto";

import { newId, nowIso } from "../types/ids.js";
import { CONTRACT_SCHEMA_VERSION } from "./contract-models.js";

export interface ContractEnvelope<TPayload = unknown> {
  readonly envelopeId: string;
  readonly schemaVersion: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly timestamp: string;
  readonly signature: string | null;
  readonly payload: TPayload;
  readonly ttl: number | null;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ContractEnvelopeVerificationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly verifiedAt: string;
}

export function createContractEnvelope<TPayload>(input: {
  payload: TPayload;
  envelopeId?: string;
  schemaVersion?: string;
  commandId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  timestamp?: string;
  signature?: string | null;
  ttl?: number | null;
  metadata?: Readonly<Record<string, string>>;
}): ContractEnvelope<TPayload> {
  return {
    envelopeId: input.envelopeId ?? newId("env"),
    schemaVersion: input.schemaVersion ?? CONTRACT_SCHEMA_VERSION,
    commandId: input.commandId ?? newId("cmd"),
    idempotencyKey: input.idempotencyKey ?? newId("idem"),
    correlationId: input.correlationId ?? newId("corr"),
    timestamp: input.timestamp ?? nowIso(),
    signature: input.signature ?? null,
    payload: input.payload,
    ttl: input.ttl ?? null,
    metadata: input.metadata ?? {},
  };
}

export function verifyContractEnvelopeSignature<TPayload>(
  envelope: ContractEnvelope<TPayload>,
  secretKey: string,
): ContractEnvelopeVerificationResult {
  const verifiedAt = nowIso();

  if (envelope.signature == null) {
    return {
      valid: false,
      error: "signature_missing: ContractEnvelope has no signature",
      verifiedAt,
    };
  }

  try {
    const payloadString = typeof envelope.payload === "string"
      ? envelope.payload
      : JSON.stringify(envelope.payload);
    const signatureInput = `${envelope.schemaVersion}:${envelope.commandId}:${envelope.correlationId}:${envelope.timestamp}:${payloadString}`;
    const expectedSignature = createHmac("sha256", secretKey)
      .update(signatureInput)
      .digest("hex");

    if (!timingSafeHexEqual(envelope.signature, expectedSignature)) {
      return {
        valid: false,
        error: "signature_invalid: ContractEnvelope signature verification failed",
        verifiedAt,
      };
    }

    return {
      valid: true,
      verifiedAt,
    };
  } catch (err) {
    return {
      valid: false,
      error: `signature_verification_error: ${err instanceof Error ? err.message : "unknown error"}`,
      verifiedAt,
    };
  }
}

export function signContractEnvelope<TPayload>(
  envelope: ContractEnvelope<TPayload>,
  secretKey: string,
): ContractEnvelope<TPayload> {
  const payloadString = typeof envelope.payload === "string"
    ? envelope.payload
    : JSON.stringify(envelope.payload);
  const signatureInput = `${envelope.schemaVersion}:${envelope.commandId}:${envelope.correlationId}:${envelope.timestamp}:${payloadString}`;
  const signature = createHmac("sha256", secretKey)
    .update(signatureInput)
    .digest("hex");

  return {
    ...envelope,
    signature,
  };
}

function timingSafeHexEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
