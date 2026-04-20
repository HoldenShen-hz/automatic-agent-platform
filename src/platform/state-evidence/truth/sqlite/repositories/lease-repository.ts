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
import { queryAll } from "../query-helper.js";

export class LeaseRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * List lease audits for an execution.
   */
  public listLeaseAudits(executionId: string): LeaseAuditRecord[] {
    return queryAll<LeaseAuditRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS executionId,
        lease_id AS leaseId,
        worker_id AS workerId,
        fencing_token AS fencingToken,
        event_type AS eventType,
        reason_code AS reasonCode,
        recorded_at AS recordedAt
       FROM lease_audits
       WHERE execution_id = ?
       ORDER BY recorded_at ASC`,
      executionId,
    );
  }
}
