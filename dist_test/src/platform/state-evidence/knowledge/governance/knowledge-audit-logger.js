import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
export class KnowledgeAuditLogger {
    logger;
    constructor(logger = new StructuredLogger({ retentionLimit: 100 })) {
        this.logger = logger;
    }
    logAccess(decision) {
        const level = decision.allowed ? (decision.crossDomain ? "warn" : "info") : "error";
        this.logger.log({
            level,
            message: "knowledge.audit.access",
            correlationId: decision.principalId ?? decision.namespace,
            data: {
                principalId: decision.principalId,
                principalDomainId: decision.principalDomainId,
                namespace: decision.namespace,
                ownerDomainId: decision.ownerDomainId,
                action: decision.action,
                allowed: decision.allowed,
                crossDomain: decision.crossDomain,
                reasonCode: decision.reasonCode,
            },
        });
    }
    recent(limit = 50) {
        return this.logger.recent(limit);
    }
}
//# sourceMappingURL=knowledge-audit-logger.js.map