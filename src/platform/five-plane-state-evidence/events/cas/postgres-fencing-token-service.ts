import type { AsyncSqlConnection, AsyncSqlDatabase } from "../../truth/async-sql-database.js";
import type { FenceInfo, FenceMode, FencingTokenValidation } from "./fencing-token-service.js";
import { PostgresFenceRepository } from "./postgres-fence-repository.js";

const FENCING_TOKEN_SEPARATOR = "::";
const DEFAULT_FENCE_TTL_MS = 5 * 60 * 1000;

function buildFenceKey(executionId: string, nodeId: string): string {
  return `${executionId}-${nodeId}`;
}

export class AsyncFencingTokenService {
  private static readonly globalTokenCounter = {
    value: 0,
    getAndIncrement(): number {
      return ++this.value;
    },
  };

  public constructor(
    private readonly database: AsyncSqlDatabase,
    private readonly nodeId: string = "default-node",
  ) {}

  public generateFencingToken(executionId: string, nodeId: string): string {
    const counter = AsyncFencingTokenService.globalTokenCounter.getAndIncrement();
    const timestamp = Date.now();
    return [
      encodeURIComponent(executionId),
      encodeURIComponent(nodeId),
      String(counter),
      String(timestamp),
    ].join(FENCING_TOKEN_SEPARATOR);
  }

  public validateFencingToken(token: string, expectedOwner: string): FencingTokenValidation {
    if (!token || token.trim().length === 0) {
      return { valid: false, reason: "Empty or invalid token" };
    }
    const parts = token.split(FENCING_TOKEN_SEPARATOR);
    if (parts.length !== 4) {
      return { valid: false, reason: "Token format invalid" };
    }

    const [encodedExecutionId, encodedNodeId, counterPart, timestampPart] = parts;
    const executionId = decodeURIComponent(encodedExecutionId ?? "");
    const ownerNodeId = decodeURIComponent(encodedNodeId ?? "");
    const counter = Number.parseInt(counterPart ?? "", 10);
    const timestamp = Number.parseInt(timestampPart ?? "", 10);
    if (!executionId || !ownerNodeId || !Number.isFinite(counter) || !Number.isFinite(timestamp)) {
      return { valid: false, reason: "Token format invalid" };
    }
    if (ownerNodeId !== expectedOwner) {
      return {
        valid: false,
        owner: ownerNodeId,
        reason: "Token not owned by expected owner",
      };
    }
    return {
      valid: true,
      executionId,
      owner: ownerNodeId,
    };
  }

  public async acquireFence(executionId: string, mode: FenceMode): Promise<FenceInfo | null> {
    return this.database.transaction(async (conn) => {
      await this.lockExecutionFence(conn, executionId);
      const repo = new PostgresFenceRepository(conn);
      await repo.deleteExpired(new Date());

      for (const fence of await repo.getFencesForExecution(executionId)) {
        if (fence.ownerNodeId === this.nodeId && (fence.mode === "exclusive" || mode === "exclusive")) {
          return fence;
        }
      }

      for (const fence of await repo.getFencesForExecution(executionId)) {
        if (fence.ownerNodeId !== this.nodeId && (fence.mode === "exclusive" || mode === "exclusive")) {
          return null;
        }
      }

      const fenceInfo: FenceInfo = {
        executionId,
        mode,
        fenceToken: this.generateFencingToken(executionId, this.nodeId),
        ownerNodeId: this.nodeId,
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + DEFAULT_FENCE_TTL_MS),
      };
      await repo.set(buildFenceKey(executionId, this.nodeId), fenceInfo);
      return fenceInfo;
    });
  }

  public async releaseFence(executionId: string): Promise<boolean> {
    return this.database.transaction(async (conn) => {
      await this.lockExecutionFence(conn, executionId);
      const repo = new PostgresFenceRepository(conn);
      const fence = (await repo.getFencesForExecution(executionId)).find(
        (entry) => entry.ownerNodeId === this.nodeId,
      );
      if (fence == null) {
        return false;
      }
      return repo.delete(buildFenceKey(fence.executionId, fence.ownerNodeId));
    });
  }

  public async isFenceHeld(executionId: string): Promise<boolean> {
    const repo = await this.pruneExpiredAndCreateRepository();
    return (await repo.getFencesForExecution(executionId)).length > 0;
  }

  public async getFenceInfo(executionId: string): Promise<FenceInfo | undefined> {
    const repo = await this.pruneExpiredAndCreateRepository();
    return (await repo.getFencesForExecution(executionId)).find((fence) => fence.ownerNodeId === this.nodeId);
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public async clearAllFences(): Promise<void> {
    await this.database.transaction(async (conn) => {
      const repo = new PostgresFenceRepository(conn);
      for (const fence of await repo.getFencesForNode(this.nodeId)) {
        await repo.delete(buildFenceKey(fence.executionId, fence.ownerNodeId));
      }
    });
  }

  public async getActiveFenceCount(): Promise<number> {
    const repo = await this.pruneExpiredAndCreateRepository();
    return (await repo.getAll()).length;
  }

  private async pruneExpiredAndCreateRepository(): Promise<PostgresFenceRepository> {
    const repo = new PostgresFenceRepository(this.database.asyncConnection);
    await repo.deleteExpired(new Date());
    return repo;
  }

  private async lockExecutionFence(conn: AsyncSqlConnection, executionId: string): Promise<void> {
    await conn.query("SELECT pg_advisory_xact_lock(hashtext($1))", executionId);
  }
}

export function createPostgresFencingTokenService(
  database: AsyncSqlDatabase,
  nodeId: string = "default-node",
): AsyncFencingTokenService {
  return new AsyncFencingTokenService(database, nodeId);
}
