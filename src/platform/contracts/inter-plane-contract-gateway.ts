/**
 * Inter-Plane Contract Gateway
 *
 * Provides secure, isolated communication between planes using:
 * - ContractEnvelope with HMAC-SHA256 signature verification (R7-44)
 * - Bulkhead isolation pattern for fault isolation (R7-45)
 *
 * Per §5.5 and §9.1, all inter-plane messages must be wrapped in ContractEnvelope
 * with signature verification, and plane-to-plane calls must be bulkhead-isolated.
 */

import { newId, nowIso } from "./types/ids.js";
import { ValidationError } from "./errors.js";
import {
  type ContractEnvelope,
  type ContractEnvelopeVerificationResult,
  createContractEnvelope,
  verifyContractEnvelopeSignature,
  signContractEnvelope,
} from "./executable-contracts/index.js";
import {
  BulkheadIsolator,
  BulkheadRegistry,
  BulkheadConfig,
  DEFAULT_BULKHEAD_CONFIG,
  BulkheadRejectionError,
  BulkheadTimeoutError,
} from "../stability/bulkhead-isolation.js";

/**
 * Plane names in the five-plane architecture.
 */
export type PlaneName = "P1_Interface" | "P2_Control" | "P3_Orchestration" | "P4_Execution" | "P5_StateEvidence";

/**
 * Inter-plane message types that can be exchanged between planes.
 */
export type InterPlaneMessageType =
  | "directive"
  | "request"
  | "response"
  | "event"
  | "command";

/**
 * Configuration for inter-plane communication.
 */
export interface InterPlaneGatewayConfig {
  /** Shared secret key for HMAC signature verification */
  sharedSecretKey: string;
  /** Default bulkhead configuration */
  bulkheadConfig?: Partial<BulkheadConfig>;
  /** Whether to require signature verification (default: true) */
  requireSignatureVerification?: boolean;
  /** Default TTL for envelopes in milliseconds (default: 30000) */
  defaultTtlMs?: number;
}

/**
 * Result of sending an inter-plane message.
 */
export interface InterPlaneSendResult<TPayload = unknown> {
  /** The envelope that was sent */
  envelope: ContractEnvelope<TPayload>;
  /** Whether the send was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Time taken to send in milliseconds */
  durationMs: number;
}

/**
 * Result of receiving an inter-plane message.
 */
export interface InterPlaneReceiveResult<TPayload = unknown> {
  /** The verified envelope */
  envelope: ContractEnvelope<TPayload>;
  /** Whether verification passed */
  verified: boolean;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Default inter-plane gateway configuration.
 */
const DEFAULT_GATEWAY_CONFIG: Required<InterPlaneGatewayConfig> = {
  sharedSecretKey: "",
  bulkheadConfig: DEFAULT_BULKHEAD_CONFIG,
  requireSignatureVerification: true,
  defaultTtlMs: 30_000,
};

/**
 * Inter-Plane Contract Gateway
 *
 * Provides secure, bulkhead-isolated communication between planes.
 * All messages are wrapped in ContractEnvelope with HMAC-SHA256 signatures.
 *
 * R7-44 FIX: ContractEnvelope signature verification for inter-plane contracts.
 * R7-45 FIX: Bulkhead isolation pattern for plane-to-plane communication.
 */
export class InterPlaneContractGateway {
  private readonly config: Required<InterPlaneGatewayConfig>;
  private readonly bulkheadRegistry: BulkheadRegistry;
  private readonly outgoingBulkheads = new Map<PlaneName, BulkheadIsolator>();
  private readonly incomingBulkheads = new Map<PlaneName, BulkheadIsolator>();

  public constructor(config: InterPlaneGatewayConfig) {
    if (!config.sharedSecretKey || config.sharedSecretKey.trim().length === 0) {
      throw new ValidationError(
        "inter_plane_gateway.secret_required",
        "inter_plane_gateway.secret_required: Shared secret key is required for inter-plane communication.",
      );
    }
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.bulkheadRegistry = new BulkheadRegistry();
  }

  /**
   * Gets or creates a bulkhead isolator for outgoing calls to a target plane.
   * R7-45 FIX: Each caller-callee pair has isolated bulkhead limits.
   */
  private getOutgoingBulkhead(targetPlane: PlaneName): BulkheadIsolator {
    let isolator = this.outgoingBulkheads.get(targetPlane);
    if (isolator == null) {
      isolator = this.bulkheadRegistry.getOrCreate(
        `outgoing:${this.getPlaneIdentifier()}:${targetPlane}`,
        this.config.bulkheadConfig,
      );
      this.outgoingBulkheads.set(targetPlane, isolator);
    }
    return isolator;
  }

  /**
   * Gets or creates a bulkhead isolator for incoming calls from a source plane.
   * R7-45 FIX: Each caller-callee pair has isolated bulkhead limits.
   */
  private getIncomingBulkhead(sourcePlane: PlaneName): BulkheadIsolator {
    let isolator = this.incomingBulkheads.get(sourcePlane);
    if (isolator == null) {
      isolator = this.bulkheadRegistry.getOrCreate(
        `incoming:${sourcePlane}:${this.getPlaneIdentifier()}`,
        this.config.bulkheadConfig,
      );
      this.incomingBulkheads.set(sourcePlane, isolator);
    }
    return isolator;
  }

  /**
   * Gets the plane identifier for this gateway instance.
   * Subclasses should override this if they have a specific plane identity.
   */
  protected getPlaneIdentifier(): PlaneName {
    return "P3_Orchestration"; // Default; should be overridden per plane
  }

  /**
   * Creates an envelope for sending to a target plane.
   * R7-44 FIX: All inter-plane messages are wrapped in signed ContractEnvelope.
   */
  public createOutgoingEnvelope<TPayload>(input: {
    payload: TPayload;
    targetPlane: PlaneName;
    messageType: InterPlaneMessageType;
    correlationId?: string;
    idempotencyKey?: string;
    ttl?: number | null;
    metadata?: Readonly<Record<string, string>>;
  }): ContractEnvelope<TPayload> {
    const metadata: Record<string, string> = {
      ...input.metadata ?? {},
      sourcePlane: this.getPlaneIdentifier(),
      targetPlane: input.targetPlane,
      messageType: input.messageType,
    };

    return createContractEnvelope({
      payload: input.payload,
      envelopeId: newId("ipenv"),
      schemaVersion: "v4.3",
      commandId: newId("ipcmd"),
      idempotencyKey: input.idempotencyKey ?? newId("ipidem"),
      correlationId: input.correlationId ?? newId("ipcorr"),
      timestamp: nowIso(),
      signature: null, // Signature added when sending
      ttl: input.ttl ?? this.config.defaultTtlMs,
      metadata,
    });
  }

  /**
   * Sends a message to a target plane with bulkhead isolation and signature.
   * R7-44 FIX: Message is signed with HMAC-SHA256.
   * R7-45 FIX: Uses bulkhead isolator to prevent cascade failures.
   */
  public async sendToPlane<TPayload, TResult>(
    targetPlane: PlaneName,
    payload: TPayload,
    messageType: InterPlaneMessageType,
    sendFn: (envelope: ContractEnvelope<TPayload>) => Promise<TResult>,
    options?: {
      correlationId?: string;
      idempotencyKey?: string;
      ttl?: number | null;
      metadata?: Readonly<Record<string, string>>;
    },
  ): Promise<InterPlaneSendResult<TPayload>> {
    const startTime = Date.now();
    const bulkhead = this.getOutgoingBulkhead(targetPlane);

    // Build envelope options with proper optional property handling
    const envelopeOptions: {
      payload: TPayload;
      targetPlane: PlaneName;
      messageType: InterPlaneMessageType;
      correlationId?: string;
      idempotencyKey?: string;
      ttl?: number | null;
      metadata?: Readonly<Record<string, string>>;
    } = {
      payload,
      targetPlane,
      messageType,
    };

    // Only set optional properties if provided (required for exactOptionalPropertyTypes)
    if (options?.correlationId != null) {
      envelopeOptions.correlationId = options.correlationId;
    }
    if (options?.idempotencyKey != null) {
      envelopeOptions.idempotencyKey = options.idempotencyKey;
    }
    if (options?.ttl != null) {
      envelopeOptions.ttl = options.ttl;
    }
    if (options?.metadata != null) {
      envelopeOptions.metadata = options.metadata;
    }

    // Create and sign the envelope
    const envelope = this.createOutgoingEnvelope(envelopeOptions);

    const signedEnvelope = signContractEnvelope(envelope, this.config.sharedSecretKey);

    try {
      // Execute with bulkhead isolation
      // R7-45 FIX: Bulkhead pattern prevents cascade failures
      const result = await bulkhead.execute(async () => {
        return await sendFn(signedEnvelope);
      });

      return {
        envelope: signedEnvelope,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Classify error for proper handling
      if (error instanceof BulkheadRejectionError) {
        return {
          envelope: signedEnvelope,
          success: false,
          error: `bulkhead_rejected: ${error.message}`,
          durationMs: Date.now() - startTime,
        };
      }
      if (error instanceof BulkheadTimeoutError) {
        return {
          envelope: signedEnvelope,
          success: false,
          error: `bulkhead_timeout: ${error.message}`,
          durationMs: Date.now() - startTime,
        };
      }
      return {
        envelope: signedEnvelope,
        success: false,
        error: error instanceof Error ? error.message : "unknown_error",
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Receives a message from a source plane and verifies its signature.
   * R7-44 FIX: Signature verification ensures authenticity and integrity.
   *
   * @param envelope - The received ContractEnvelope
   * @param sourcePlane - The plane that sent the message
   * @returns Verification result with the envelope if valid
   */
  public receiveFromPlane<TPayload>(
    envelope: ContractEnvelope<TPayload>,
    sourcePlane: PlaneName,
  ): InterPlaneReceiveResult<TPayload> {
    const bulkhead = this.getIncomingBulkhead(sourcePlane);

    // Check TTL if present
    if (envelope.ttl != null) {
      const envelopeTime = new Date(envelope.timestamp).getTime();
      const now = Date.now();
      if (now - envelopeTime > envelope.ttl) {
        return {
          envelope,
          verified: false,
          error: "envelope_expired: Inter-plane message TTL exceeded",
        };
      }
    }

    // Verify signature if required
    if (this.config.requireSignatureVerification) {
      const verification = verifyContractEnvelopeSignature(envelope, this.config.sharedSecretKey);
      if (!verification.valid) {
        return {
          envelope,
          verified: false,
          ...(verification.error != null && { error: verification.error }),
        };
      }
    }

    // Record the call in the incoming bulkhead (for metrics)
    // Note: This is a no-op metric recording; actual rate limiting happens at send time
    const metrics = bulkhead.getMetrics();
    void metrics; // Metrics available for observability

    return {
      envelope,
      verified: true,
    };
  }

  /**
   * Extracts the source plane from an envelope's metadata.
   */
  public static getSourcePlane<TPayload>(envelope: ContractEnvelope<TPayload>): PlaneName | null {
    return (envelope.metadata?.sourcePlane as PlaneName) ?? null;
  }

  /**
   * Extracts the target plane from an envelope's metadata.
   */
  public static getTargetPlane<TPayload>(envelope: ContractEnvelope<TPayload>): PlaneName | null {
    return (envelope.metadata?.targetPlane as PlaneName) ?? null;
  }

  /**
   * Gets bulkhead metrics for all outgoing connections.
   * Useful for monitoring and observability.
   */
  public getOutgoingBulkheadMetrics(): Array<{ targetPlane: PlaneName; metrics: ReturnType<BulkheadIsolator["getMetrics"]> }> {
    return [...this.outgoingBulkheads.entries()].map(([plane, isolator]) => ({
      targetPlane: plane,
      metrics: isolator.getMetrics(),
    }));
  }

  /**
   * Gets bulkhead metrics for all incoming connections.
   * Useful for monitoring and observability.
   */
  public getIncomingBulkheadMetrics(): Array<{ sourcePlane: PlaneName; metrics: ReturnType<BulkheadIsolator["getMetrics"]> }> {
    return [...this.incomingBulkheads.entries()].map(([plane, isolator]) => ({
      sourcePlane: plane,
      metrics: isolator.getMetrics(),
    }));
  }
}

/**
 * Creates a new InterPlaneContractGateway with the given configuration.
 */
export function createInterPlaneGateway(config: InterPlaneGatewayConfig): InterPlaneContractGateway {
  return new InterPlaneContractGateway(config);
}

// =============================================================================
// R7-44/R7-45 Integration Points
// =============================================================================
//
// The following integration points should be used when planes communicate:
//
// 1. For P3 → P4 execution calls:
//    Use InterPlaneContractGateway.sendToPlane() with bulkhead isolation
//
// 2. For P4 → P5 state evidence calls:
//    Use InterPlaneContractGateway.sendToPlane() with bulkhead isolation
//
// 3. For any plane receiving requests:
//    Use InterPlaneContractGateway.receiveFromPlane() to verify signature
//
// Example usage:
//
//   const gateway = createInterPlaneGateway({ sharedSecretKey: "..." });
//
//   // Sending a request
//   const result = await gateway.sendToPlane(
//     "P4_Execution",
//     { taskId, action: "execute" },
//     "request",
//     async (envelope) => {
//       // Actual HTTP/gRPC call to P4
//       return await p4Client.execute(envelope);
//     }
//   );
//
//   // Receiving a request
//   const received = gateway.receiveFromPlane(incomingEnvelope, "P3_Orchestration");
//   if (!received.verified) {
//     throw new Error(`Signature verification failed: ${received.error}`);
//   }
//
// =============================================================================
