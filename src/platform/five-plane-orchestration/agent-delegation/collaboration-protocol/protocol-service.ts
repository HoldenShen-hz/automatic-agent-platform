import { newId, nowIso } from "../../../contracts/types/ids.js";
import { ACPInvariantEnforcer, type InvariantContext } from "./invariant-enforcer.js";
import { ACPMessageSchema, type ACPMessage, type ACPMessageType } from "./types.js";

export class CollaborationProtocolService {
  private readonly acceptedOutboundMessageIds = new Map<string, number>();
  private readonly acceptedOutboundIdempotencyKeys = new Map<string, number>();
  private readonly acceptedInboundMessageIds = new Map<string, number>();
  private readonly acceptedInboundIdempotencyKeys = new Map<string, number>();
  private readonly lastOutboundSequenceByCorrelation = new Map<string, number>();
  private readonly lastInboundSequenceByCorrelation = new Map<string, number>();
  private static readonly MAX_TRACKED_ENTRIES = 2048;

  public constructor(private readonly invariantEnforcer: ACPInvariantEnforcer = new ACPInvariantEnforcer()) {}

  public createMessage(type: ACPMessageType, fields: Omit<ACPMessage, "messageId" | "messageType" | "timestamp">): ACPMessage {
    const lastSequence = this.lastOutboundSequenceByCorrelation.get(fields.correlation_id) ?? 0;
    return ACPMessageSchema.parse({
      ...fields,
      messageId: newId("acp_msg"),
      idempotency_key: fields.idempotency_key ?? newId("acp_idem"),
      sequence_no: fields.sequence_no ?? lastSequence + 1,
      expectedPreviousSequence: fields.expectedPreviousSequence ?? lastSequence,
      messageType: type,
      timestamp: nowIso(),
    });
  }

  public validateAndSend(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    const parsed = ACPMessageSchema.parse(message);
    const result = this.invariantEnforcer.enforceAll(parsed, context);
    const sequencing = this.enforceSequencing(parsed, {
      acceptedMessageIds: this.acceptedOutboundMessageIds,
      acceptedIdempotencyKeys: this.acceptedOutboundIdempotencyKeys,
      sequenceState: this.lastOutboundSequenceByCorrelation,
      enforceExpectedPreviousSequence: true,
    });
    if (!result.passed || sequencing.length > 0) {
      return {
        accepted: false,
        violations: [...result.violations, ...sequencing],
      };
    }

    this.remember(this.acceptedOutboundMessageIds, parsed.messageId);
    if (parsed.idempotency_key != null) {
      this.remember(this.acceptedOutboundIdempotencyKeys, parsed.idempotency_key);
    }
    if (parsed.sequence_no != null) {
      this.lastOutboundSequenceByCorrelation.set(parsed.correlation_id, parsed.sequence_no);
      this.pruneSequenceState(this.lastOutboundSequenceByCorrelation);
    }

    return {
      accepted: true,
      violations: [],
    };
  }

  public handleIncoming(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    const parsed = ACPMessageSchema.parse(message);
    const result = this.invariantEnforcer.enforceAll(parsed, context);
    const sequencing = this.enforceSequencing(parsed, {
      acceptedMessageIds: this.acceptedInboundMessageIds,
      acceptedIdempotencyKeys: this.acceptedInboundIdempotencyKeys,
      sequenceState: this.lastInboundSequenceByCorrelation,
      enforceExpectedPreviousSequence: false,
    });
    if (!result.passed || sequencing.length > 0) {
      return {
        accepted: false,
        violations: [...result.violations, ...sequencing],
      };
    }
    this.remember(this.acceptedInboundMessageIds, parsed.messageId);
    if (parsed.idempotency_key != null) {
      this.remember(this.acceptedInboundIdempotencyKeys, parsed.idempotency_key);
    }
    if (parsed.sequence_no != null) {
      this.lastInboundSequenceByCorrelation.set(parsed.correlation_id, parsed.sequence_no);
      this.pruneSequenceState(this.lastInboundSequenceByCorrelation);
    }
    return {
      accepted: true,
      violations: [],
    };
  }

  private enforceSequencing(
    message: ACPMessage,
    input: {
      acceptedMessageIds: Map<string, number>;
      acceptedIdempotencyKeys: Map<string, number>;
      sequenceState: Map<string, number>;
      enforceExpectedPreviousSequence: boolean;
    },
  ): string[] {
    const violations: string[] = [];
    if (input.acceptedMessageIds.has(message.messageId)) {
      violations.push("delegation.message_duplicate");
    }
    if (message.idempotency_key != null && input.acceptedIdempotencyKeys.has(message.idempotency_key)) {
      violations.push("delegation.idempotency_duplicate");
    }
    if (message.sequence_no != null) {
      const lastSequence = input.sequenceState.get(message.correlation_id) ?? 0;
      if (input.enforceExpectedPreviousSequence
        && message.expectedPreviousSequence != null
        && message.expectedPreviousSequence !== lastSequence) {
        violations.push("delegation.expected_previous_sequence_mismatch");
      }
      if (message.sequence_no !== lastSequence + 1) {
        violations.push("delegation.sequence_gap");
      }
    }
    return violations;
  }

  private remember(cache: Map<string, number>, key: string): void {
    cache.set(key, Date.now());
    while (cache.size > CollaborationProtocolService.MAX_TRACKED_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (typeof oldestKey !== "string") {
        break;
      }
      cache.delete(oldestKey);
    }
  }

  private pruneSequenceState(cache: Map<string, number>): void {
    while (cache.size > CollaborationProtocolService.MAX_TRACKED_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (typeof oldestKey !== "string") {
        break;
      }
      cache.delete(oldestKey);
    }
  }
}
