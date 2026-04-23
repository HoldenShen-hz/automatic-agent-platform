import { newId, nowIso } from "../../../contracts/types/ids.js";
import { ACPInvariantEnforcer } from "./invariant-enforcer.js";
import { ACPMessageSchema } from "./types.js";
export class CollaborationProtocolService {
    invariantEnforcer;
    constructor(invariantEnforcer = new ACPInvariantEnforcer()) {
        this.invariantEnforcer = invariantEnforcer;
    }
    createMessage(type, fields) {
        return ACPMessageSchema.parse({
            ...fields,
            messageId: newId("acp_msg"),
            messageType: type,
            timestamp: nowIso(),
        });
    }
    validateAndSend(message, context) {
        const parsed = ACPMessageSchema.parse(message);
        const result = this.invariantEnforcer.enforceAll(parsed, context);
        return {
            accepted: result.passed,
            violations: result.violations,
        };
    }
    handleIncoming(message, context) {
        return this.validateAndSend(message, context);
    }
}
//# sourceMappingURL=protocol-service.js.map