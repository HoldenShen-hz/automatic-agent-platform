/**
 * Agent Delegation - Topology Validator
 *
 * Validates delegation topology constraints including depth limits,
 * fanout limits, and cycle detection.
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */
import { ValidationError } from "../../contracts/errors.js";
// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_MAX_DEPTH = 3;
export const DEFAULT_MAX_FANOUT = 10;
// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────
export class DelegationDepthExceededError extends ValidationError {
    constructor(currentDepth, maxDepth) {
        super("delegation.depth_exceeded", `Delegation depth ${currentDepth} exceeds maximum ${maxDepth}`, { details: { currentDepth, maxDepth } });
    }
}
export class DelegationFanoutExceededError extends ValidationError {
    constructor(currentFanout, maxFanout) {
        super("delegation.fanout_exceeded", `Delegation fanout ${currentFanout} exceeds maximum ${maxFanout}`, { details: { currentFanout, maxFanout } });
    }
}
export class DelegationCycleDetectedError extends ValidationError {
    constructor(packId, chain) {
        super("delegation.cycle_detected", `Cycle detected: pack ${packId} already in delegation chain`, { details: { packId, chain } });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Topology Validator
// ─────────────────────────────────────────────────────────────────────────────
export class TopologyValidator {
    maxDepth;
    maxFanout;
    allowedPackIds;
    constructor(config) {
        this.maxDepth = config.maxDepth ?? DEFAULT_MAX_DEPTH;
        this.maxFanout = config.maxFanout ?? DEFAULT_MAX_FANOUT;
        this.allowedPackIds = config.allowedPackIds
            ? new Set(config.allowedPackIds)
            : null;
    }
    /**
     * Validates depth constraint.
     *
     * @param currentDepth - Current delegation depth
     * @throws DelegationDepthExceededError if depth exceeds maximum
     */
    validateDepth(currentDepth) {
        if (currentDepth >= this.maxDepth) {
            throw new DelegationDepthExceededError(currentDepth, this.maxDepth);
        }
    }
    /**
     * Validates fanout constraint.
     *
     * @param activeDelegations - Number of active delegations from parent
     * @throws DelegationFanoutExceededError if fanout exceeds maximum
     */
    validateFanout(activeDelegations) {
        if (activeDelegations >= this.maxFanout) {
            throw new DelegationFanoutExceededError(activeDelegations, this.maxFanout);
        }
    }
    /**
     * Detects cycles in delegation chain.
     * A cycle occurs when a pack_id appears twice in the same delegation chain.
     *
     * @param packId - Target pack ID
     * @param chain - Current delegation chain (list of pack IDs)
     * @throws DelegationCycleDetectedError if cycle detected
     */
    detectCycle(packId, chain) {
        if (chain.includes(packId)) {
            throw new DelegationCycleDetectedError(packId, chain);
        }
    }
    /**
     * Validates that a pack_id is in the allowed list.
     *
     * @param packId - Pack ID to validate
     * @throws ValidationError if pack_id not allowed
     */
    validatePackId(packId) {
        if (this.allowedPackIds && !this.allowedPackIds.has(packId)) {
            throw new ValidationError("delegation.pack_id_not_allowed", `Pack ${packId} is not in the allowed delegation list`, { details: { packId, allowedPackIds: [...this.allowedPackIds] } });
        }
    }
    /**
     * Full topology validation for a delegation request.
     *
     * @param params - Validation parameters
     * @throws DelegationDepthExceededError | DelegationFanoutExceededError | DelegationCycleDetectedError
     */
    validate(params) {
        this.validateDepth(params.currentDepth);
        this.validateFanout(params.activeDelegations);
        this.detectCycle(params.targetPackId, params.delegationChain);
        this.validatePackId(params.targetPackId);
    }
    /**
     * Returns the maximum depth allowed.
     */
    getMaxDepth() {
        return this.maxDepth;
    }
    /**
     * Returns the maximum fanout allowed.
     */
    getMaxFanout() {
        return this.maxFanout;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────
export function createTopologyValidator(config) {
    const fullConfig = {
        maxDepth: config?.maxDepth ?? DEFAULT_MAX_DEPTH,
        maxFanout: config?.maxFanout ?? DEFAULT_MAX_FANOUT,
    };
    if (config?.allowedPackIds) {
        fullConfig.allowedPackIds = config.allowedPackIds;
    }
    return new TopologyValidator(fullConfig);
}
//# sourceMappingURL=topology-validator.js.map