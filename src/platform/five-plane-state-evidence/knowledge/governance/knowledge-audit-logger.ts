import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { KnowledgeAccessDecision } from "./access-control.js";

export class KnowledgeAuditLogger {
  public constructor(private readonly logger: StructuredLogger = new StructuredLogger({ retentionLimit: 100 })) {}

  public logAccess(decision: KnowledgeAccessDecision): void {
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

  public recent(limit = 50) {
    return this.logger.recent(limit);
  }
}
