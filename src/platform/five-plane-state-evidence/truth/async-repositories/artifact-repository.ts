/**
 * AsyncArtifactRepository - Async data access for artifacts.
 *
 * This is the async PostgreSQL-compatible version of ArtifactRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type { ArtifactRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncArtifactRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async insertArtifact(artifact: ArtifactRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO artifacts (
        artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type,
        size_bytes, checksum, lineage_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      artifact.artifactId,
      artifact.taskId,
      artifact.executionId,
      artifact.stepId,
      artifact.kind,
      artifact.storagePath,
      artifact.fileName,
      artifact.mimeType,
      artifact.sizeBytes,
      artifact.checksum,
      artifact.lineageJson,
      artifact.createdAt,
    );
  }

  /**
   * Get an artifact by ID.
   */
  public async getArtifact(artifactId: string): Promise<ArtifactRecord | null> {
    const result = await asyncQueryOne<ArtifactRecord>(
      this.conn,
      `SELECT
        artifact_id AS "artifactId",
        task_id AS "taskId",
        execution_id AS "executionId",
        step_id AS "stepId",
        kind,
        storage_path AS "storagePath",
        file_name AS "fileName",
        mime_type AS "mimeType",
        size_bytes AS "sizeBytes",
        checksum,
        lineage_json AS "lineageJson",
        created_at AS "createdAt"
       FROM artifacts
       WHERE artifact_id = $1`,
      artifactId,
    );
    return result ?? null;
  }

  /**
   * List artifacts for a task.
   */
  public async listArtifactsByTask(taskId: string, tenantId?: string | null): Promise<ArtifactRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<ArtifactRecord>(
        this.conn,
        `SELECT
          a.artifact_id AS "artifactId",
          a.task_id AS "taskId",
          a.execution_id AS "executionId",
          a.step_id AS "stepId",
          a.kind,
          a.storage_path AS "storagePath",
          a.file_name AS "fileName",
          a.mime_type AS "mimeType",
          a.size_bytes AS "sizeBytes",
          a.checksum,
          a.lineage_json AS "lineageJson",
          a.created_at AS "createdAt"
         FROM artifacts a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = $1
           AND t.tenant_id = $2
         ORDER BY a.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<ArtifactRecord>(
      this.conn,
      `SELECT
        artifact_id AS "artifactId",
        task_id AS "taskId",
        execution_id AS "executionId",
        step_id AS "stepId",
        kind,
        storage_path AS "storagePath",
        file_name AS "fileName",
        mime_type AS "mimeType",
        size_bytes AS "sizeBytes",
        checksum,
        lineage_json AS "lineageJson",
        created_at AS "createdAt"
       FROM artifacts
       WHERE task_id = $1
       ORDER BY created_at ASC`,
      taskId,
    );
  }
}
