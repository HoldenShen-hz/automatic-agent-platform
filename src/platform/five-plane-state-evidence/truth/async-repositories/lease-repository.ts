/**
 * AsyncLeaseRepository - Async data access for execution leases and lease audits.
 *
 * This is the async PostgreSQL-compatible version of LeaseRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type { LeaseAuditRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncQueryAll } from "../async-query-helper.js";

export class AsyncLeaseRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  /**
   * List lease audits for an execution.
   */
  public async listLeaseAudits(executionId: string): Promise<LeaseAuditRecord[]> {
    return asyncQueryAll<LeaseAuditRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        lease_id AS "leaseId",
        worker_id AS "workerId",
        fencing_token AS "fencingToken",
        event_type AS "eventType",
        reason_code AS "reasonCode",
        recorded_at AS "recordedAt"
       FROM lease_audits
       WHERE execution_id = $1
       ORDER BY recorded_at ASC`,
      executionId,
    );
  }
}
