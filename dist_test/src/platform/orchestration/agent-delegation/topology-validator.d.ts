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
export declare const DEFAULT_MAX_DEPTH = 3;
export declare const DEFAULT_MAX_FANOUT = 10;
export interface TopologyValidatorConfig {
    maxDepth: number;
    maxFanout: number;
    allowedPackIds?: readonly string[];
}
export declare class DelegationDepthExceededError extends ValidationError {
    constructor(currentDepth: number, maxDepth: number);
}
export declare class DelegationFanoutExceededError extends ValidationError {
    constructor(currentFanout: number, maxFanout: number);
}
export declare class DelegationCycleDetectedError extends ValidationError {
    constructor(packId: string, chain: readonly string[]);
}
export declare class TopologyValidator {
    private readonly maxDepth;
    private readonly maxFanout;
    private readonly allowedPackIds;
    constructor(config: TopologyValidatorConfig);
    /**
     * Validates depth constraint.
     *
     * @param currentDepth - Current delegation depth
     * @throws DelegationDepthExceededError if depth exceeds maximum
     */
    validateDepth(currentDepth: number): void;
    /**
     * Validates fanout constraint.
     *
     * @param activeDelegations - Number of active delegations from parent
     * @throws DelegationFanoutExceededError if fanout exceeds maximum
     */
    validateFanout(activeDelegations: number): void;
    /**
     * Detects cycles in delegation chain.
     * A cycle occurs when a pack_id appears twice in the same delegation chain.
     *
     * @param packId - Target pack ID
     * @param chain - Current delegation chain (list of pack IDs)
     * @throws DelegationCycleDetectedError if cycle detected
     */
    detectCycle(packId: string, chain: readonly string[]): void;
    /**
     * Validates that a pack_id is in the allowed list.
     *
     * @param packId - Pack ID to validate
     * @throws ValidationError if pack_id not allowed
     */
    validatePackId(packId: string): void;
    /**
     * Full topology validation for a delegation request.
     *
     * @param params - Validation parameters
     * @throws DelegationDepthExceededError | DelegationFanoutExceededError | DelegationCycleDetectedError
     */
    validate(params: {
        currentDepth: number;
        activeDelegations: number;
        targetPackId: string;
        delegationChain: readonly string[];
    }): void;
    /**
     * Returns the maximum depth allowed.
     */
    getMaxDepth(): number;
    /**
     * Returns the maximum fanout allowed.
     */
    getMaxFanout(): number;
}
export declare function createTopologyValidator(config?: Partial<TopologyValidatorConfig>): TopologyValidator;
