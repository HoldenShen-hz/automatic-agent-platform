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
    activeFences = new Map();
    // Fencing token counter for monotonically increasing tokens
    tokenCounter = 0;
    // Node ID for this instance
    nodeId;
    constructor(nodeId = "default-node") {
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
    generateFencingToken(executionId, nodeId) {
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
    validateFencingToken(token, expectedOwner) {
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
        const executionIdPart = parts[0];
        if (!tokenNodeId || !executionIdPart) {
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
    acquireFence(executionId, mode) {
        // Check if any fence exists for this execution
        for (const fence of this.activeFences.values()) {
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
        const fenceInfo = {
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
    /**
     * Releases a fence for an execution.
     *
     * @param executionId - The execution ID to release fence for
     * @returns true if fence was released, false if no fence was held
     */
    releaseFence(executionId) {
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
    isFenceHeld(executionId) {
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
    getFenceInfo(executionId) {
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
    getNodeId() {
        return this.nodeId;
    }
    /**
     * Clears all active fences. Used for testing.
     */
    clearAllFences() {
        this.activeFences.clear();
    }
    /**
     * Gets count of active fences. Used for testing.
     *
     * @returns Number of active fences
     */
    getActiveFenceCount() {
        return this.activeFences.size;
    }
}
//# sourceMappingURL=fencing-token-service.js.map