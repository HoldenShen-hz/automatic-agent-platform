import type { SqliteConnection } from "../../truth/sqlite/query-helper.js";
import { execute, queryAll, queryOne } from "../../truth/sqlite/query-helper.js";
import type { FenceInfo, FenceRepository } from "./fencing-token-service.js";

interface FenceRecordRow {
  fence_key: string;
  execution_id: string;
  owner_node_id: string;
  mode: "shared" | "exclusive";
  fence_token: string;
  acquired_at: string;
  expires_at: string | null;
}

function toFenceInfo(row: FenceRecordRow): FenceInfo {
  return {
    executionId: row.execution_id,
    mode: row.mode,
    fenceToken: row.fence_token,
    ownerNodeId: row.owner_node_id,
    acquiredAt: new Date(row.acquired_at),
    expiresAt: row.expires_at == null ? null : new Date(row.expires_at),
  };
}

export class SqliteFenceRepository implements FenceRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public getFencesForExecution(executionId: string): FenceInfo[] {
    return queryAll<FenceRecordRow>(
      this.conn,
      `SELECT fence_key, execution_id, owner_node_id, mode, fence_token, acquired_at, expires_at
       FROM fence_records
       WHERE execution_id = ?`,
      executionId,
    ).map(toFenceInfo);
  }

  public getFencesForNode(nodeId: string): FenceInfo[] {
    return queryAll<FenceRecordRow>(
      this.conn,
      `SELECT fence_key, execution_id, owner_node_id, mode, fence_token, acquired_at, expires_at
       FROM fence_records
       WHERE owner_node_id = ?`,
      nodeId,
    ).map(toFenceInfo);
  }

  public get(key: string): FenceInfo | undefined {
    const row = queryOne<FenceRecordRow>(
      this.conn,
      `SELECT fence_key, execution_id, owner_node_id, mode, fence_token, acquired_at, expires_at
       FROM fence_records
       WHERE fence_key = ?`,
      key,
    );
    return row == null ? undefined : toFenceInfo(row);
  }

  public set(key: string, fence: FenceInfo): void {
    this.conn
      .prepare(
        `INSERT INTO fence_records (
           fence_key,
           execution_id,
           owner_node_id,
           mode,
           fence_token,
           acquired_at,
           expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(fence_key) DO UPDATE SET
           execution_id = excluded.execution_id,
           owner_node_id = excluded.owner_node_id,
           mode = excluded.mode,
           fence_token = excluded.fence_token,
           acquired_at = excluded.acquired_at,
           expires_at = excluded.expires_at`,
      )
      .run(
        key,
        fence.executionId,
        fence.ownerNodeId,
        fence.mode,
        fence.fenceToken,
        fence.acquiredAt.toISOString(),
        fence.expiresAt?.toISOString() ?? null,
      );
  }

  public delete(key: string): boolean {
    return execute(
      this.conn,
      `DELETE FROM fence_records WHERE fence_key = ?`,
      key,
    ) > 0;
  }

  public deleteExpired(now: Date): number {
    return execute(
      this.conn,
      `DELETE FROM fence_records
       WHERE expires_at IS NOT NULL AND expires_at <= ?`,
      now.toISOString(),
    );
  }

  public getAll(): FenceInfo[] {
    return queryAll<FenceRecordRow>(
      this.conn,
      `SELECT fence_key, execution_id, owner_node_id, mode, fence_token, acquired_at, expires_at
       FROM fence_records`,
    ).map(toFenceInfo);
  }
}
