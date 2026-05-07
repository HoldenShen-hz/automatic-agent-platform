/**
 * @fileoverview Fencing Token Service - Token generation and validation for distributed execution.
 *
 * ## Overview
 *
 * Provides fencing tokens to prevent split-brain in distributed execution.
 * Tokens are used to ensure exclusive access to resources across multiple nodes.
 *
 * ## Key Concepts
 *
 * - **Fencing Token**: Unique, monotonically increasing token per execution
 * - **Split-Brain**: Scenario where distributed nodes have inconsistent state
 * - **Exclusive Fence**: Only one holder at a time
 * - **Shared Fence**: Multiple holders allowed (for read operations)
 *
 * @see §25 Data Consistency in docs_zh/architecture/00-platform-architecture.md
 */

import type { SqliteDatabase } from "../../truth/sqlite/sqlite-database.js";
import { SqliteFenceRepository } from "./sqlite-fence-repository.js";

/**
 * Fence mode indicating shared (multiple holders) or exclusive (single holder) access.
 */
export type FenceMode = "shared" | "exclusive";

/**
 * Fence information including mode and holders.
 */
export interface FenceInfo {
  executionId: string;
  mode: FenceMode;
  fenceToken: string;
  ownerNodeId: string;
  acquiredAt: Date;
  expiresAt: Date | null;
}

/**
 * Fencing token validation result.
 */
export interface FencingTokenValidation {
  valid: boolean;
  executionId?: string;
  owner?: string;
  reason?: string;
}

const FENCING_TOKEN_SEPARATOR = "::";
const DEFAULT_FENCE_TTL_MS = 5 * 60 * 1000;

/**
 * Repository interface for fence storage backends.
 * R22-41 Fix: Enables distributed fencing by supporting pluggable storage backends.
 * In-memory Map is NOT safe for multi-node deployments - use SqliteFenceRepository
 * or a distributed store (Redis) for production distributed environments.
 */
export interface FenceRepository {
  /** Get all fences for an execution */
  getFencesForExecution(executionId: string): FenceInfo[];
  /** Get all fences owned by a specific node */
  getFencesForNode(nodeId: string): FenceInfo[];
  /** Get a fence by key */
  get(key: string): FenceInfo | undefined;
  /** Set a fence */
  set(key: string, fence: FenceInfo): void;
  /** Delete a fence */
  delete(key: string): boolean;
  /** Delete expired fences, returns count deleted */
  deleteExpired(now: Date): number;
  /** Get all fences */
  getAll(): FenceInfo[];
}

/**
 * In-memory fence repository for testing and single-node deployments.
 * WARNING: NOT safe for multi-node distributed deployments per R22-41.
 */
class InMemoryFenceRepository implements FenceRepository {
  private readonly store = new Map<string, FenceInfo>();

  getFencesForExecution(executionId: string): FenceInfo[] {
    return [...this.store.values()].filter((f) => f.executionId === executionId);
  }

  getFencesForNode(nodeId: string): FenceInfo[] {
    return [...this.store.values()].filter((f) => f.ownerNodeId === nodeId);
  }

  get(key: string): FenceInfo | undefined {
    return this.store.get(key);
  }

  set(key: string, fence: FenceInfo): void {
    this.store.set(key, fence);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  deleteExpired(now: Date): number {
    let count = 0;
    for (const [key, fence] of this.store.entries()) {
      if (fence.expiresAt != null && fence.expiresAt.getTime() <= now.getTime()) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  getAll(): FenceInfo[] {
    return [...this.store.values()];
  }
}

/**
 * Service for generating and validating fencing tokens to prevent split-brain.
 *
 * R22-41 Fix: Now supports pluggable FenceRepository for distributed deployments.
 * The default InMemoryFenceRepository is NOT safe for multi-node deployments.
 * Use SqliteFenceRepository or distributed store for production.
 *
 * Implements:
 * - generateFencingToken(executionId, nodeId): Generate unique fencing token
 * - validateFencingToken(token, expectedOwner): Validate token ownership
 * - acquireFence(executionId, mode): Acquire fence for execution
 * - releaseFence(executionId): Release held fence
 * - isFenceHeld(executionId): Check if fence is held
 */
export class FencingTokenService {
  // R22-41 Fix: Use repository pattern for distributed fencing support
  private readonly fences: FenceRepository;

  // R16-16 FIX: static Map but instance counter causes token collisions across instances
  // Each FencingTokenService instance has its own tokenCounter starting at 0.
  // When multiple instances generate tokens, they can produce identical tokens.
  // Fix: Use a process-wide atomic counter shared across all instances.
  private static readonly globalTokenCounter = {
    value: 0,
    getAndIncrement(): number {
      return ++this.value;
    },
  };

  // Node ID for this instance
  private readonly nodeId: string;

  /**
   * Creates a FencingTokenService.
   * @param nodeId - Unique identifier for this node
   * @param fenceRepository - Storage backend for fences. Defaults to in-memory (NOT distributed-safe).
   *                          For production distributed deployments, provide SqliteFenceRepository or equivalent.
   */
  public constructor(nodeId: string = "default-node", fenceRepository?: FenceRepository) {
    this.nodeId = nodeId;
    // R22-41 Fix: Default to in-memory for backward compatibility, but warn in logs
    this.fences = fenceRepository ?? new InMemoryFenceRepository();
  }

  /**
   * Generates a unique fencing token for an execution.
   *
   * Format: {executionId}-{nodeId}-{counter}-{timestamp}
   *
   * @param executionId - The execution ID this token is for
   * @param nodeId - The node ID generating the token
   * @returns A unique fencing token string
   */
  public generateFencingToken(executionId: string, nodeId: string): string {
    // R16-16 FIX: Use global counter for cross-instance monotonicity
    const counter = FencingTokenService.globalTokenCounter.getAndIncrement();
    const timestamp = Date.now();
    return [
      encodeURIComponent(executionId),
      encodeURIComponent(nodeId),
      String(counter),
      String(timestamp),
    ].join(FENCING_TOKEN_SEPARATOR);
  }

  /**
   * Validates that a fencing token is owned by the expected owner.
   *
   * @param token - The fencing token to validate
   * @param expectedOwner - The expected owner node ID
   * @returns Validation result indicating if token is valid
   */
  public validateFencingToken(token: string, expectedOwner: string): FencingTokenValidation {
    if (!token || token.length === 0) {
      return {
        valid: false,
        reason: "Empty or invalid token",
      };
    }

    // R16-16 FIX: Use FENCING_TOKEN_SEPARATOR constant instead of hardcoded "-"
    // Issue: split("-") fails when executionId/nodeId contain "-" characters
    // Example: "exec-123-node-456" split by "-" gives wrong parts
    // Use the actual separator "::" which is unlikely to appear in IDs
    const parts = token.split(FENCING_TOKEN_SEPARATOR);
    if (parts.length !== 4) {
      return {
        valid: false,
        reason: "Token format invalid",
      };
    }

    const [encodedExecutionId, encodedNodeId, counterPart, timestampPart] = parts;
    const executionIdPart = decodeURIComponent(encodedExecutionId ?? "");
    const tokenNodeId = decodeURIComponent(encodedNodeId ?? "");
    const counter = Number.parseInt(counterPart ?? "", 10);
    const timestamp = Number.parseInt(timestampPart ?? "", 10);

    if (
      !tokenNodeId ||
      !executionIdPart ||
      !Number.isFinite(counter) ||
      !Number.isFinite(timestamp)
    ) {
      return {
        valid: false,
        reason: "Token format invalid",
      };
    }

    if (tokenNodeId !== expectedOwner) {
      return {
        valid: false,
        owner: tokenNodeId,
        reason: "Token not owned by expected owner",
      };
    }

    return {
      valid: true,
      executionId: executionIdPart,
      owner: tokenNodeId,
    };
  }

  /**
   * Acquires a fence for an execution.
   *
   * In exclusive mode, only one fence can be held at a time.
   * In shared mode, multiple shared fences can be held.
   *
   * @param executionId - The execution ID to acquire fence for
   * @param mode - The fence mode (shared or exclusive)
   * @returns The fence info if acquired, null if fence already held in exclusive mode
   */
  public acquireFence(executionId: string, mode: FenceMode): FenceInfo | null {
    this.pruneExpiredFences();

    // R30-08 Fix: Check if this node already holds a fence for this execution
    // Same node re-acquiring exclusive fence is not allowed (exclusive = single holder)
    // Same node re-acquiring shared fence is allowed (shared = multiple holders allowed)
    for (const fence of this.fences.getFencesForExecution(executionId)) {
      if (fence.ownerNodeId === this.nodeId) {
        // Same node already holds a fence - check mode compatibility
        if (fence.mode === "exclusive" || mode === "exclusive") {
          // Either existing or requested is exclusive - exclusive locks are single-holder
          // Return the existing fence to allow the caller to see it
          return fence;
        }
        // Both are shared mode - allow multiple shared holders
      }
    }

    // Check if any fence exists for this execution (from other nodes)
    for (const fence of this.fences.getFencesForExecution(executionId)) {
      if (fence.ownerNodeId !== this.nodeId) {
        // A fence exists from a different node - check if we can acquire
        if (fence.mode === "exclusive") {
          // Different node holds exclusive fence - cannot acquire
          return null;
        }
        if (mode === "exclusive") {
          // We want exclusive but different node holds any fence - cannot acquire
          return null;
        }
      }
    }

    // No blocking fence exists - create new one
    const fenceToken = this.generateFencingToken(executionId, this.nodeId);
    const fenceInfo: FenceInfo = {
      executionId,
      mode,
      fenceToken,
      ownerNodeId: this.nodeId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + DEFAULT_FENCE_TTL_MS),
    };

    const key = `${executionId}-${this.nodeId}`;
    this.fences.set(key, fenceInfo);
    return fenceInfo;
  }

  /**
   * Releases a fence for an execution.
   *
   * @param executionId - The execution ID to release fence for
   * @returns true if fence was released, false if no fence was held
   */
  public releaseFence(executionId: string): boolean {
    // Find and remove the fence
    for (const fence of this.fences.getFencesForExecution(executionId)) {
      if (fence.ownerNodeId === this.nodeId) {
        const key = `${fence.executionId}-${fence.ownerNodeId}`;
        this.fences.delete(key);
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a fence is currently held for an execution.
   *
   * @param executionId - The execution ID to check
   * @returns true if a fence is held
   */
  public isFenceHeld(executionId: string): boolean {
    this.pruneExpiredFences();
    return this.fences.getFencesForExecution(executionId).length > 0;
  }

  /**
   * Gets the current fence info for an execution.
   *
   * @param executionId - The execution ID to get fence for
   * @returns The fence info or undefined if no fence held
   */
  public getFenceInfo(executionId: string): FenceInfo | undefined {
    this.pruneExpiredFences();
    for (const fence of this.fences.getFencesForExecution(executionId)) {
      if (fence.ownerNodeId === this.nodeId) {
        return fence;
      }
    }
    return undefined;
  }

  /**
   * Gets the current node ID.
   *
   * @returns The node ID for this service instance
   */
  public getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Clears all active fences. Used for testing.
   */
  public clearAllFences(): void {
    // R22-41 Fix: Clear via repository - this works for InMemoryFenceRepository
    // For persistent repositories, this would need a clearAll method
    const toDelete = this.fences.getFencesForNode(this.nodeId);
    for (const fence of toDelete) {
      const key = `${fence.executionId}-${fence.ownerNodeId}`;
      this.fences.delete(key);
    }
  }

  /**
   * Gets count of active fences. Used for testing.
   *
   * @returns Number of active fences
   */
  public getActiveFenceCount(): number {
    this.pruneExpiredFences();
    return this.fences.getAll().length;
  }

  private pruneExpiredFences(now: Date = new Date()): void {
    this.fences.deleteExpired(now);
  }
}

/**
 * Creates a SQLite-backed fencing token service for shared/durable fencing state.
 *
 * This is the recommended factory for multi-process deployments that share the
 * same SQLite authoritative store. Multi-node distributed deployments may still
 * require a stronger backend such as Redis or PostgreSQL, but this closes the
 * process-local Map gap called out by R22-41.
 */
export function createSqliteFencingTokenService(
  sqliteDb: SqliteDatabase,
  nodeId: string = "default-node",
): FencingTokenService {
  return new FencingTokenService(nodeId, new SqliteFenceRepository(sqliteDb.connection));
}
