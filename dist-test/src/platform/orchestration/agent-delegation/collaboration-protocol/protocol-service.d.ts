import { ACPInvariantEnforcer, type InvariantContext } from "./invariant-enforcer.js";
import { type ACPMessage, type ACPMessageType } from "./types.js";
export declare class CollaborationProtocolService {
    private readonly invariantEnforcer;
    constructor(invariantEnforcer?: ACPInvariantEnforcer);
    createMessage(type: ACPMessageType, fields: Omit<ACPMessage, "messageId" | "messageType" | "timestamp">): ACPMessage;
    validateAndSend(message: ACPMessage, context: InvariantContext): {
        accepted: boolean;
        violations: string[];
    };
    handleIncoming(message: ACPMessage, context: InvariantContext): {
        accepted: boolean;
        violations: string[];
    };
}
