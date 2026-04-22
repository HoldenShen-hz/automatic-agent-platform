import { newId, nowIso } from "../../../contracts/types/ids.js";
import { ACPInvariantEnforcer, type InvariantContext } from "./invariant-enforcer.js";
import { ACPMessageSchema, type ACPMessage, type ACPMessageType } from "./types.js";

export class CollaborationProtocolService {
  public constructor(private readonly invariantEnforcer: ACPInvariantEnforcer = new ACPInvariantEnforcer()) {}

  public createMessage(type: ACPMessageType, fields: Omit<ACPMessage, "messageId" | "messageType" | "timestamp">): ACPMessage {
    return ACPMessageSchema.parse({
      ...fields,
      messageId: newId("acp_msg"),
      messageType: type,
      timestamp: nowIso(),
    });
  }

  public validateAndSend(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    const parsed = ACPMessageSchema.parse(message);
    const result = this.invariantEnforcer.enforceAll(parsed, context);
    return {
      accepted: result.passed,
      violations: result.violations,
    };
  }

  public handleIncoming(message: ACPMessage, context: InvariantContext): { accepted: boolean; violations: string[] } {
    return this.validateAndSend(message, context);
  }
}
