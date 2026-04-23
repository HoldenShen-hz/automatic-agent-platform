/**
 * Agent Delegation - Context Isolator
 *
 * Provides context security isolation for delegated agents.
 * Handles permission inheritance narrowing, context propagation,
 * and sandbox tier inheritance.
 *
 * Architecture: §19 Agent Delegation
 * @see docs_zh/architecture/00-platform-architecture.md §19
 */
import type { AgentContext, PermissionSet, DelegationSpec } from "./delegation-types.js";
export interface IsolatedContext {
    context: AgentContext;
    inheritedPermissions: PermissionSet;
    narrowedPermissions: PermissionSet;
    isolationLevel: IsolationLevel;
}
export declare enum IsolationLevel {
    /** Full inheritance - child has same permissions as parent */
    FULL = "full",
    /** Partial inheritance - permissions narrowed to required subset */
    PARTIAL = "partial",
    /** Minimal inheritance - only explicitly requested permissions */
    MINIMAL = "minimal",
    /** Sandboxed - permissions heavily restricted based on sandbox tier */
    SANDBOXED = "sandboxed"
}
export declare class ContextIsolator {
    /**
     * Creates an isolated context for a delegated child agent.
     *
     * @param parent - Parent agent context
     * @param spec - Delegation specification with required permissions
     * @returns Isolated context with narrowed permissions
     */
    isolate(parent: AgentContext, spec: DelegationSpec): IsolatedContext;
    /**
     * Validates that a permission request is within bounds.
     *
     * @param parent - Parent permissions
     * @param requested - Requested permissions
     * @returns true if request is valid
     */
    validatePermissionRequest(parent: PermissionSet, requested: PermissionSet): boolean;
    /**
     * Merges two permission sets, taking the more restrictive values.
     *
     * @param base - Base permissions
     * @param override - Override permissions
     * @returns Merged permissions (most restrictive)
     */
    mergePermissions(base: PermissionSet, override: PermissionSet): PermissionSet;
    private determineIsolationLevel;
    private determineSandboxTier;
    private narrowPermissionsInternal;
    private intersectLists;
    private mergeActions;
    private mergeConstraints;
    private mergeDomainLists;
}
export declare function createContextIsolator(): ContextIsolator;
