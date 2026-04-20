/**
 * AsyncDivisionRepository - Async data access for data movement and division records.
 *
 * This is the async PostgreSQL-compatible version of DivisionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type { DataMovementJobRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncQueryAll } from "../async-query-helper.js";

export class AsyncDivisionRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  /**
   * List data movement job records with optional filtering.
   */
  public async listDataMovementJobRecords(options: {
    tenantId?: string | null;
    status?: DataMovementJobRecord["status"];
    movementType?: DataMovementJobRecord["movementType"];
    limit?: number;
  } = {}): Promise<DataMovementJobRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (options.tenantId !== undefined && options.tenantId !== null) {
      conditions.push(`tenant_id = $${parameters.length + 1}`);
      parameters.push(options.tenantId);
    }
    if (options.status != null) {
      conditions.push(`status = $${parameters.length + 1}`);
      parameters.push(options.status);
    }
    if (options.movementType != null) {
      conditions.push(`movement_type = $${parameters.length + 1}`);
      parameters.push(options.movementType);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return asyncQueryAll<DataMovementJobRecord>(
      this.conn,
      `SELECT
         job_id AS "jobId",
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         source_namespace_id AS "sourceNamespaceId",
         target_namespace_id AS "targetNamespaceId",
         source_plane AS "sourcePlane",
         target_plane AS "targetPlane",
         movement_type AS "movementType",
         input_refs_json AS "inputRefsJson",
         status,
         started_at AS "startedAt",
         finished_at AS "finishedAt",
         report_json AS "reportJson"
       FROM data_movement_jobs
       ${whereClause}
       ORDER BY started_at DESC, job_id ASC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }
}
