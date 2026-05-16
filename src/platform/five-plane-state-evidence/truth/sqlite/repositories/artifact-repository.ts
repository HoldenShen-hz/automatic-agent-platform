/**
 * ArtifactRepository - Data access for artifacts.
 *
 * This repository handles all data access for:
 * - ArtifactRecord (artifacts table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */

import type { ArtifactRecord } from "../sqlite-repository-contracts.js";
import type { SqliteConnection } from "../query-helper.js";
import { queryAll, queryOne } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

export class ArtifactRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertArtifact(artifact: ArtifactRecord): void {
    this.conn
      .prepare(
        `INSERT INTO artifacts (
          artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type,
          size_bytes, checksum, lineage_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
  public getArtifact(artifactId: string): ArtifactRecord | null {
    return queryOne<ArtifactRecord>(
      this.conn,
      `SELECT
        artifact_id AS artifactId,
        task_id AS taskId,
        execution_id AS executionId,
        step_id AS stepId,
        kind,
        storage_path AS storagePath,
        file_name AS fileName,
        mime_type AS mimeType,
        size_bytes AS sizeBytes,
        checksum,
        lineage_json AS lineageJson,
        created_at AS createdAt
       FROM artifacts
       WHERE artifact_id = ?`,
      artifactId,
    ) ?? null;
  }

  /**
   * List artifacts for a task.
   */
  public listArtifactsByTask(taskId: string, tenantId?: string | null): ArtifactRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<ArtifactRecord>(
        this.conn,
        `SELECT
          a.artifact_id AS artifactId,
          a.task_id AS taskId,
          a.execution_id AS executionId,
          a.step_id AS stepId,
          a.kind,
          a.storage_path AS storagePath,
          a.file_name AS fileName,
          a.mime_type AS mimeType,
          a.size_bytes AS sizeBytes,
          a.checksum,
          a.lineage_json AS lineageJson,
          a.created_at AS createdAt
         FROM artifacts a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = ?
           AND t.tenant_id = ?
         ORDER BY a.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<ArtifactRecord>(
      this.conn,
      `SELECT
        artifact_id AS artifactId,
        task_id AS taskId,
        execution_id AS executionId,
        step_id AS stepId,
        kind,
        storage_path AS storagePath,
        file_name AS fileName,
        mime_type AS mimeType,
        size_bytes AS sizeBytes,
        checksum,
        lineage_json AS lineageJson,
        created_at AS createdAt
       FROM artifacts
       WHERE task_id = ?
       ORDER BY created_at ASC`,
      taskId,
    );
  }
}
