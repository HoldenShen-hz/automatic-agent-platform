/**
 * DivisionRepository - Data access for data movement and division records.
 *
 * This repository handles all data access for:
 * - DataMovementJobRecord (data_movement_jobs table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */

import type { DataMovementJobRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
import { queryAll } from "../query-helper.js";

export class DivisionRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * List data movement job records with optional filtering.
   */
  public listDataMovementJobRecords(options: {
    tenantId?: string | null;
    status?: DataMovementJobRecord["status"];
    movementType?: DataMovementJobRecord["movementType"];
    limit?: number;
  } = {}): DataMovementJobRecord[] {
    const conditions: string[] = [];
    const parameters: Array<string | number | null> = [];

    if (options.tenantId !== undefined) {
      conditions.push("tenant_id IS ?");
      parameters.push(options.tenantId);
    }
    if (options.status != null) {
      conditions.push("status = ?");
      parameters.push(options.status);
    }
    if (options.movementType != null) {
      conditions.push("movement_type = ?");
      parameters.push(options.movementType);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return queryAll<DataMovementJobRecord>(
      this.conn,
      `SELECT
         job_id AS jobId,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         source_namespace_id AS sourceNamespaceId,
         target_namespace_id AS targetNamespaceId,
         source_plane AS sourcePlane,
         target_plane AS targetPlane,
         movement_type AS movementType,
         input_refs_json AS inputRefsJson,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         report_json AS reportJson
       FROM data_movement_jobs
       ${whereClause}
       ORDER BY started_at DESC, job_id ASC
       LIMIT ?`,
      ...parameters,
    );
  }
}
