/**
 * LeaseRepository - Data access for execution leases and lease audits.
 *
 * This repository handles all data access for:
 * - LeaseAuditRecord (lease_audits table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { LeaseAuditRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class LeaseRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    /**
     * List lease audits for an execution.
     */
    listLeaseAudits(executionId: string): LeaseAuditRecord[];
}
