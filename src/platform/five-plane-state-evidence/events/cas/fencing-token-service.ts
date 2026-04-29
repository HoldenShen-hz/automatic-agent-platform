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
 * Service for generating and validating fencing tokens to prevent split-brain.
 *
 * Implements:
 * - generateFencingToken(executionId, nodeId): Generate unique fencing token
 * - validateFencingToken(token, expectedOwner): Validate token ownership
 * - acquireFence(executionId, mode): Acquire fence for execution
 * - releaseFence(executionId): Release held fence
 * - isFenceHeld(executionId): Check if fence is held
 */
export class FencingTokenService {
  // Active fences are process-wide so multiple service instances can enforce exclusivity.
  private static readonly activeFences = new Map<string, FenceInfo>();

  // Fencing token counter for monotonically increasing tokens
  private tokenCounter = 0;

  // Node ID for this instance
  private readonly nodeId: string;

  public constructor(nodeId: string = "default-node") {
    this.nodeId = nodeId;
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
    this.tokenCounter++;
    const timestamp = Date.now();
    return [
      encodeURIComponent(executionId),
      encodeURIComponent(nodeId),
      String(this.tokenCounter),
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
    // Check if any fence exists for this execution
    for (const fence of FencingTokenService.activeFences.values()) {
      if (fence.executionId === executionId) {
        // A fence exists - check if we can acquire
        if (fence.ownerNodeId !== this.nodeId && fence.mode === "exclusive") {
          // Different node holds exclusive fence - cannot acquire
          return null;
        }
        if (fence.ownerNodeId !== this.nodeId && mode === "exclusive") {
          // Different node holds any fence and we want exclusive - cannot acquire
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

    FencingTokenService.activeFences.set(`${executionId}-${this.nodeId}`, fenceInfo);
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
    for (const [key, fence] of FencingTokenService.activeFences.entries()) {
      if (fence.executionId === executionId && fence.ownerNodeId === this.nodeId) {
        FencingTokenService.activeFences.delete(key);
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
    for (const fence of FencingTokenService.activeFences.values()) {
      if (fence.executionId === executionId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the current fence info for an execution.
   *
   * @param executionId - The execution ID to get fence for
   * @returns The fence info or undefined if no fence held
   */
  public getFenceInfo(executionId: string): FenceInfo | undefined {
    this.pruneExpiredFences();
    for (const fence of FencingTokenService.activeFences.values()) {
      if (fence.executionId === executionId && fence.ownerNodeId === this.nodeId) {
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
    FencingTokenService.activeFences.clear();
  }

  /**
   * Gets count of active fences. Used for testing.
   *
   * @returns Number of active fences
   */
  public getActiveFenceCount(): number {
    this.pruneExpiredFences();
    return FencingTokenService.activeFences.size;
  }

  private pruneExpiredFences(now: Date = new Date()): void {
    for (const [key, fence] of FencingTokenService.activeFences.entries()) {
      if (fence.expiresAt != null && fence.expiresAt.getTime() <= now.getTime()) {
        FencingTokenService.activeFences.delete(key);
      }
    }
  }
}
