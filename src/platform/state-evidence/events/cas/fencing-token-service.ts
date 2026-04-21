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
  // Active fences (executionId -> FenceInfo)
  private readonly activeFences = new Map<string, FenceInfo>();

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
    return `${executionId}-${nodeId}-${this.tokenCounter}-${timestamp}`;
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

    const parts = token.split("-");
    if (parts.length < 4) {
      return {
        valid: false,
        reason: "Token format invalid",
      };
    }

    // Token format: {executionId}-{nodeId}-{counter}-{timestamp}
    const tokenNodeId = parts[1];

        if (tokenNodeId !== expectedOwner) {
      return {
        valid: false,
        owner: tokenNodeId,
        reason: "Token not owned by expected owner",
      };
    }

    return {
      valid: true,
      executionId: parts[0],
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
    const existing = this.activeFences.get(executionId);

    if (existing !== undefined) {
      // Fence already exists
      if (mode === "shared" && existing.mode === "shared") {
        // Shared mode allows multiple holders - create new fence info
        const fenceToken = this.generateFencingToken(executionId, this.nodeId);
        const fenceInfo: FenceInfo = {
          executionId,
          mode,
          fenceToken,
          ownerNodeId: this.nodeId,
          acquiredAt: new Date(),
          expiresAt: null,
        };
        this.activeFences.set(`${executionId}-${this.nodeId}`, fenceInfo);
        return fenceInfo;
      }

      if (mode === "exclusive") {
        // Exclusive mode - check if current holder is same node
        if (existing.ownerNodeId === this.nodeId) {
          // Same node - allow re-acquisition
          const fenceToken = this.generateFencingToken(executionId, this.nodeId);
          const fenceInfo: FenceInfo = {
            executionId,
            mode,
            fenceToken,
            ownerNodeId: this.nodeId,
            acquiredAt: new Date(),
            expiresAt: null,
          };
          this.activeFences.set(executionId, fenceInfo);
          return fenceInfo;
        }
        // Different node holds exclusive fence - cannot acquire
        return null;
      }
    }

    // No existing fence - create new one
    const fenceToken = this.generateFencingToken(executionId, this.nodeId);
    const fenceInfo: FenceInfo = {
      executionId,
      mode,
      fenceToken,
      ownerNodeId: this.nodeId,
      acquiredAt: new Date(),
      expiresAt: null,
    };

    this.activeFences.set(executionId, fenceInfo);
    return fenceInfo;
  }

  /**
   * Releases a fence for an execution.
   *
   * @param executionId - The execution ID to release fence for
   * @returns true if fence was released, false if no fence was held
   */
  public releaseFence(executionId: string): boolean {
    const keyToDelete: string | null = null;

    // Find and remove the fence
    for (const [key, fence] of this.activeFences.entries()) {
      if (fence.executionId === executionId && fence.ownerNodeId === this.nodeId) {
        this.activeFences.delete(key);
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
    for (const fence of this.activeFences.values()) {
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
    for (const fence of this.activeFences.values()) {
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
    this.activeFences.clear();
  }

  /**
   * Gets count of active fences. Used for testing.
   *
   * @returns Number of active fences
   */
  public getActiveFenceCount(): number {
    return this.activeFences.size;
  }
}
