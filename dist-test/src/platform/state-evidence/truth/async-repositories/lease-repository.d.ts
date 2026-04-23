/**
 * AsyncLeaseRepository - Async data access for execution leases and lease audits.
 *
 * This is the async PostgreSQL-compatible version of LeaseRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { LeaseAuditRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncLeaseRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    /**
     * List lease audits for an execution.
     */
    listLeaseAudits(executionId: string): Promise<LeaseAuditRecord[]>;
}
