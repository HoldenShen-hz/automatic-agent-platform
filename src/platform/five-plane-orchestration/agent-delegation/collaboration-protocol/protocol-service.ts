import { newId, nowIso } from "../../../contracts/types/ids.js";
import { ACPInvariantEnforcer, type InvariantContext } from "./invariant-enforcer.js";
import { ACPMessageSchema, type ACPMessage, type ACPMessageInput, type ACPMessageType } from "./types.js";

export class CollaborationProtocolService {
  private readonly acceptedMessageIds = new Set<string>();
  private readonly acceptedIdempotencyKeys = new Set<string>();
  private readonly lastSequenceByCorrelation = new Map<string, number>();

  public constructor(private readonly invariantEnforcer: ACPInvariantEnforcer = new ACPInvariantEnforcer()) {}

  public createMessage(type: ACPMessageType, fields: Omit<ACPMessageInput, "messageId" | "messageType" | "timestamp">): ACPMessage {
    const lastSequence = this.lastSequenceByCorrelation.get(fields.correlation_id) ?? 0;
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

  public validateAndSend(message: ACPMessage | ACPMessageInput, context: InvariantContext): { accepted: boolean; violations: string[] } {
    const parsed = ACPMessageSchema.parse(message);
    const result = this.invariantEnforcer.enforceAll(parsed, context);
    const sequencing = this.enforceSequencing(parsed);
    if (!result.passed || sequencing.length > 0) {
      return {
        accepted: false,
        violations: [...result.violations, ...sequencing],
      };
    }

    this.acceptedMessageIds.add(parsed.messageId);
    if (parsed.idempotency_key != null) {
      this.acceptedIdempotencyKeys.add(parsed.idempotency_key);
    }
    if (parsed.sequence_no != null) {
      this.lastSequenceByCorrelation.set(parsed.correlation_id, parsed.sequence_no);
    }

    return {
      accepted: true,
      violations: [],
    };
  }

  public handleIncoming(message: ACPMessage | ACPMessageInput, context: InvariantContext): { accepted: boolean; violations: string[] } {
    return this.validateAndSend(message, context);
  }

  private enforceSequencing(message: ACPMessage): string[] {
    const violations: string[] = [];
    const sequencingEnabled = message.idempotency_key != null || message.sequence_no != null;
    if (sequencingEnabled && this.acceptedMessageIds.has(message.messageId)) {
      violations.push("delegation.message_duplicate");
    }
    if (message.idempotency_key != null && this.acceptedIdempotencyKeys.has(message.idempotency_key)) {
      violations.push("delegation.idempotency_duplicate");
    }
    if (message.sequence_no != null) {
      const lastSequence = this.lastSequenceByCorrelation.get(message.correlation_id) ?? 0;
      if (message.expectedPreviousSequence != null && message.expectedPreviousSequence !== lastSequence) {
        violations.push("delegation.expected_previous_sequence_mismatch");
      }
      if (message.sequence_no !== lastSequence + 1) {
        violations.push("delegation.sequence_gap");
      }
    }
    return violations;
  }
}
