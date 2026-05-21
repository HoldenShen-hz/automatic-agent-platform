import type { AsyncSqlConnection } from "../../truth/async-sql-database.js";
import type { FenceInfo, FenceMode } from "./fencing-token-service.js";

interface FenceRecordRow {
  executionId: string;
  mode: FenceMode;
  fenceToken: string;
  ownerNodeId: string;
  acquiredAt: string;
  expiresAt: string | null;
}

function toFenceInfo(row: FenceRecordRow): FenceInfo {
  return {
    executionId: row.executionId,
    mode: row.mode,
    fenceToken: row.fenceToken,
    ownerNodeId: row.ownerNodeId,
    acquiredAt: new Date(row.acquiredAt),
    expiresAt: row.expiresAt == null ? null : new Date(row.expiresAt),
  };
}

export class PostgresFenceRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async getFencesForExecution(executionId: string): Promise<FenceInfo[]> {
    const result = await this.conn.query<FenceRecordRow>(
      `SELECT
         execution_id AS "executionId",
         owner_node_id AS "ownerNodeId",
         mode,
         fence_token AS "fenceToken",
         acquired_at AS "acquiredAt",
         expires_at AS "expiresAt"
       FROM fence_records
       WHERE execution_id = $1`,
      executionId,
    );
    return result.rows.map(toFenceInfo);
  }

  public async getFencesForNode(nodeId: string): Promise<FenceInfo[]> {
    const result = await this.conn.query<FenceRecordRow>(
      `SELECT
         execution_id AS "executionId",
         owner_node_id AS "ownerNodeId",
         mode,
         fence_token AS "fenceToken",
         acquired_at AS "acquiredAt",
         expires_at AS "expiresAt"
       FROM fence_records
       WHERE owner_node_id = $1`,
      nodeId,
    );
    return result.rows.map(toFenceInfo);
  }

  public async set(key: string, fence: FenceInfo): Promise<void> {
    await this.conn.execute(
      `INSERT INTO fence_records (
         fence_key,
         execution_id,
         owner_node_id,
         mode,
         fence_token,
         acquired_at,
         expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (fence_key) DO UPDATE SET
         execution_id = EXCLUDED.execution_id,
         owner_node_id = EXCLUDED.owner_node_id,
         mode = EXCLUDED.mode,
         fence_token = EXCLUDED.fence_token,
         acquired_at = EXCLUDED.acquired_at,
         expires_at = EXCLUDED.expires_at`,
      key,
      fence.executionId,
      fence.ownerNodeId,
      fence.mode,
      fence.fenceToken,
      fence.acquiredAt.toISOString(),
      fence.expiresAt?.toISOString() ?? null,
    );
  }

  public async delete(key: string): Promise<boolean> {
    return (await this.conn.execute(`DELETE FROM fence_records WHERE fence_key = $1`, key)) > 0;
  }

  public async deleteByOwnerNode(nodeId: string): Promise<number> {
    return this.conn.execute(`DELETE FROM fence_records WHERE owner_node_id = $1`, nodeId);
  }

  public async deleteExpired(now: Date): Promise<number> {
    return this.conn.execute(
      `DELETE FROM fence_records
       WHERE expires_at IS NOT NULL AND expires_at <= $1`,
      now.toISOString(),
    );
  }

  public async getAll(): Promise<FenceInfo[]> {
    const result = await this.conn.query<FenceRecordRow>(
      `SELECT
         execution_id AS "executionId",
         owner_node_id AS "ownerNodeId",
         mode,
         fence_token AS "fenceToken",
         acquired_at AS "acquiredAt",
         expires_at AS "expiresAt"
       FROM fence_records`,
    );
    return result.rows.map(toFenceInfo);
  }
}
