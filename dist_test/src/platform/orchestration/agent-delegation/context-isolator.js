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
export var IsolationLevel;
(function (IsolationLevel) {
    /** Full inheritance - child has same permissions as parent */
    IsolationLevel["FULL"] = "full";
    /** Partial inheritance - permissions narrowed to required subset */
    IsolationLevel["PARTIAL"] = "partial";
    /** Minimal inheritance - only explicitly requested permissions */
    IsolationLevel["MINIMAL"] = "minimal";
    /** Sandboxed - permissions heavily restricted based on sandbox tier */
    IsolationLevel["SANDBOXED"] = "sandboxed";
})(IsolationLevel || (IsolationLevel = {}));
// ─────────────────────────────────────────────────────────────────────────────
// Context Isolator
// ─────────────────────────────────────────────────────────────────────────────
export class ContextIsolator {
    /**
     * Creates an isolated context for a delegated child agent.
     *
     * @param parent - Parent agent context
     * @param spec - Delegation specification with required permissions
     * @returns Isolated context with narrowed permissions
     */
    isolate(parent, spec) {
        // Determine isolation level based on sandbox tier and permission requirements
        const isolationLevel = this.determineIsolationLevel(parent, spec);
        // Narrow permissions based on required permissions and isolation level
        const narrowedPermissions = this.narrowPermissionsInternal(parent.permissions, spec.requiredPermissions, isolationLevel);
        // Create isolated context
        const context = {
            agentId: spec.targetAgentId,
            agentType: spec.targetAgentType,
            packId: spec.targetPackId,
            delegationDepth: parent.delegationDepth + 1,
            activeDelegations: [], // Fresh start for child
            permissions: narrowedPermissions,
            sandboxTier: this.determineSandboxTier(parent, spec),
            correlationId: `${parent.correlationId}:${spec.targetAgentId}`,
            tenantId: parent.tenantId, // Tenant context inherited
        };
        return {
            context,
            inheritedPermissions: parent.permissions,
            narrowedPermissions,
            isolationLevel,
        };
    }
    /**
     * Validates that a permission request is within bounds.
     *
     * @param parent - Parent permissions
     * @param requested - Requested permissions
     * @returns true if request is valid
     */
    validatePermissionRequest(parent, requested) {
        // Check resource access
        const resourceAccessValid = requested.resources.every((r) => parent.resources.includes(r));
        if (!resourceAccessValid)
            return false;
        // Check action access
        const actionAccessValid = requested.actions.every((a) => parent.actions.includes(a));
        if (!actionAccessValid)
            return false;
        // Check domain constraints
        if (requested.constraints.allowedDomains) {
            const parentAllowed = parent.constraints.allowedDomains ?? [];
            const allAllowed = requested.constraints.allowedDomains.every((d) => parentAllowed.includes(d));
            if (!allAllowed)
                return false;
        }
        return true;
    }
    /**
     * Merges two permission sets, taking the more restrictive values.
     *
     * @param base - Base permissions
     * @param override - Override permissions
     * @returns Merged permissions (most restrictive)
     */
    mergePermissions(base, override) {
        const mergedMaxDuration = Math.min(base.constraints.maxDurationMs ?? Infinity, override.constraints.maxDurationMs ?? Infinity);
        const mergedMaxTokens = Math.min(base.constraints.maxTokens ?? Infinity, override.constraints.maxTokens ?? Infinity);
        const mergedAllowedDomains = this.mergeDomainLists(base.constraints.allowedDomains, override.constraints.allowedDomains);
        const mergedDeniedDomains = this.mergeDomainLists(base.constraints.deniedDomains, override.constraints.deniedDomains);
        return {
            resources: override.resources.length > 0 ? override.resources : base.resources,
            actions: this.mergeActions(base.actions, override.actions),
            constraints: {
                ...(mergedMaxDuration !== Infinity ? { maxDurationMs: mergedMaxDuration } : {}),
                ...(mergedMaxTokens !== Infinity ? { maxTokens: mergedMaxTokens } : {}),
                ...(mergedAllowedDomains ? { allowedDomains: mergedAllowedDomains } : {}),
                ...(mergedDeniedDomains ? { deniedDomains: mergedDeniedDomains } : {}),
            },
        };
    }
    // ── Private Methods ─────────────────────────────────────────────────────
    determineIsolationLevel(parent, spec) {
        // Sandboxed tier always uses SANDBOXED level
        if (parent.sandboxTier === "container" || parent.sandboxTier === "scoped_external_access") {
            return IsolationLevel.SANDBOXED;
        }
        // Check if child requires significantly fewer permissions
        const permissionRatio = spec.requiredPermissions.actions.length / parent.permissions.actions.length;
        if (permissionRatio >= 0.9) {
            return IsolationLevel.FULL;
        }
        else if (permissionRatio >= 0.5) {
            return IsolationLevel.PARTIAL;
        }
        else {
            return IsolationLevel.MINIMAL;
        }
    }
    determineSandboxTier(parent, _spec) {
        // Child sandbox tier is determined by parent's sandbox tier
        // Child cannot have more privilege than parent
        return parent.sandboxTier;
    }
    narrowPermissionsInternal(parentPermissions, requiredPermissions, isolationLevel) {
        switch (isolationLevel) {
            case IsolationLevel.FULL:
                // Child gets parent's full permissions
                return { ...parentPermissions };
            case IsolationLevel.PARTIAL:
                // Child gets intersection of parent and required
                return {
                    resources: this.intersectLists(parentPermissions.resources, requiredPermissions.resources),
                    actions: this.intersectLists(parentPermissions.actions, requiredPermissions.actions),
                    constraints: this.mergeConstraints(parentPermissions.constraints, requiredPermissions.constraints),
                };
            case IsolationLevel.MINIMAL:
                // Child only gets explicitly required permissions
                return {
                    resources: requiredPermissions.resources.length > 0
                        ? requiredPermissions.resources
                        : parentPermissions.resources,
                    actions: requiredPermissions.actions.length > 0
                        ? requiredPermissions.actions
                        : parentPermissions.actions,
                    constraints: requiredPermissions.constraints,
                };
            case IsolationLevel.SANDBOXED:
                // Child gets minimal permissions with sandbox restrictions
                return {
                    resources: this.intersectLists(parentPermissions.resources, requiredPermissions.resources),
                    actions: this.intersectLists(parentPermissions.actions, requiredPermissions.actions),
                    constraints: {
                        ...this.mergeConstraints(parentPermissions.constraints, requiredPermissions.constraints),
                        // Additional restrictions for sandboxed execution
                        maxDurationMs: Math.min(requiredPermissions.constraints.maxDurationMs ?? Infinity, 60000),
                    },
                };
        }
    }
    intersectLists(parent, child) {
        if (child.length === 0)
            return [...parent];
        return parent.filter((item) => child.includes(item));
    }
    mergeActions(parent, child) {
        if (child.length === 0)
            return [...parent];
        return parent.filter((action) => child.includes(action));
    }
    mergeConstraints(parent, child) {
        const mergedMaxDuration = Math.min(parent.maxDurationMs ?? Infinity, child.maxDurationMs ?? Infinity);
        const mergedMaxTokens = Math.min(parent.maxTokens ?? Infinity, child.maxTokens ?? Infinity);
        const mergedAllowedDomains = this.mergeDomainLists(parent.allowedDomains, child.allowedDomains);
        const mergedDeniedDomains = this.mergeDomainLists(parent.deniedDomains, child.deniedDomains);
        return {
            ...(mergedMaxDuration !== Infinity ? { maxDurationMs: mergedMaxDuration } : {}),
            ...(mergedMaxTokens !== Infinity ? { maxTokens: mergedMaxTokens } : {}),
            ...(mergedAllowedDomains ? { allowedDomains: mergedAllowedDomains } : {}),
            ...(mergedDeniedDomains ? { deniedDomains: mergedDeniedDomains } : {}),
        };
    }
    mergeDomainLists(parent, child) {
        if (!child || child.length === 0)
            return parent;
        if (!parent || parent.length === 0)
            return child;
        // Return intersection
        return parent.filter((d) => child.includes(d));
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createContextIsolator() {
    return new ContextIsolator();
}
//# sourceMappingURL=context-isolator.js.map