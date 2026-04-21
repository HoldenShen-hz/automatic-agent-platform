import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { KnowledgeAccessDecision } from "./access-control.js";
export declare class KnowledgeAuditLogger {
    private readonly logger;
    constructor(logger?: StructuredLogger);
    logAccess(decision: KnowledgeAccessDecision): void;
    recent(limit?: number): import("../../../shared/observability/structured-logger.js").StructuredLogEntry[];
}
