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
export declare class FencingTokenService {
    private readonly activeFences;
    private tokenCounter;
    private readonly nodeId;
    constructor(nodeId?: string);
    /**
     * Generates a unique fencing token for an execution.
     *
     * Format: {executionId}-{nodeId}-{counter}-{timestamp}
     *
     * @param executionId - The execution ID this token is for
     * @param nodeId - The node ID generating the token
     * @returns A unique fencing token string
     */
    generateFencingToken(executionId: string, nodeId: string): string;
    /**
     * Validates that a fencing token is owned by the expected owner.
     *
     * @param token - The fencing token to validate
     * @param expectedOwner - The expected owner node ID
     * @returns Validation result indicating if token is valid
     */
    validateFencingToken(token: string, expectedOwner: string): FencingTokenValidation;
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
    acquireFence(executionId: string, mode: FenceMode): FenceInfo | null;
    /**
     * Releases a fence for an execution.
     *
     * @param executionId - The execution ID to release fence for
     * @returns true if fence was released, false if no fence was held
     */
    releaseFence(executionId: string): boolean;
    /**
     * Checks if a fence is currently held for an execution.
     *
     * @param executionId - The execution ID to check
     * @returns true if a fence is held
     */
    isFenceHeld(executionId: string): boolean;
    /**
     * Gets the current fence info for an execution.
     *
     * @param executionId - The execution ID to get fence for
     * @returns The fence info or undefined if no fence held
     */
    getFenceInfo(executionId: string): FenceInfo | undefined;
    /**
     * Gets the current node ID.
     *
     * @returns The node ID for this service instance
     */
    getNodeId(): string;
    /**
     * Clears all active fences. Used for testing.
     */
    clearAllFences(): void;
    /**
     * Gets count of active fences. Used for testing.
     *
     * @returns Number of active fences
     */
    getActiveFenceCount(): number;
}
