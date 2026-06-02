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

import { normalizeSandboxMode } from "../../five-plane-control-plane/iam/sandbox-policy.js";

import type {
  AgentContext,
  PermissionSet,
  DelegationSpec,
} from "./delegation-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Context Isolation Result
// ─────────────────────────────────────────────────────────────────────────────

export interface IsolatedContext {
  context: AgentContext;
  inheritedPermissions: PermissionSet;
  narrowedPermissions: PermissionSet;
  isolationLevel: IsolationLevel;
}

export enum IsolationLevel {
  /** Full inheritance - child has same permissions as parent */
  FULL = "full",
  /** Partial inheritance - permissions narrowed to required subset */
  PARTIAL = "partial",
  /** Minimal inheritance - only explicitly requested permissions */
  MINIMAL = "minimal",
  /** Sandboxed - permissions heavily restricted based on sandbox tier */
  SANDBOXED = "sandboxed",
}

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
  public isolate(
    parent: AgentContext,
    spec: DelegationSpec,
  ): IsolatedContext {
    // Determine isolation level based on sandbox tier and permission requirements
    const isolationLevel = this.determineIsolationLevel(parent, spec);

    // Narrow permissions based on required permissions and isolation level
    const narrowedPermissions = this.narrowPermissionsInternal(
      parent.permissions,
      spec.requiredPermissions,
      isolationLevel,
    );

    // Create isolated context
    const context: AgentContext = {
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
  public validatePermissionRequest(
    parent: PermissionSet,
    requested: PermissionSet,
  ): boolean {
    // Check resource access
    const resourceAccessValid = requested.resources.every((r) =>
      parent.resources.includes(r),
    );
    if (!resourceAccessValid) return false;

    // Check action access
    const actionAccessValid = requested.actions.every((a) =>
      parent.actions.includes(a),
    );
    if (!actionAccessValid) return false;

    // Check domain constraints
    if (requested.constraints.allowedDomains) {
      const parentAllowed = parent.constraints.allowedDomains ?? [];
      const allAllowed = requested.constraints.allowedDomains.every((d) =>
        parentAllowed.includes(d),
      );
      if (!allAllowed) return false;
    }

    const parentDenied = new Set(parent.constraints.deniedDomains ?? []);
    if ((requested.constraints.allowedDomains ?? []).some((domain) => parentDenied.has(domain))) {
      return false;
    }

    if (
      parent.constraints.maxDurationMs != null
      && requested.constraints.maxDurationMs != null
      && requested.constraints.maxDurationMs > parent.constraints.maxDurationMs
    ) {
      return false;
    }

    if (
      parent.constraints.maxTokens != null
      && requested.constraints.maxTokens != null
      && requested.constraints.maxTokens > parent.constraints.maxTokens
    ) {
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
  public mergePermissions(
    base: PermissionSet,
    override: PermissionSet,
  ): PermissionSet {
    const mergedMaxDuration = Math.min(
      base.constraints.maxDurationMs ?? Infinity,
      override.constraints.maxDurationMs ?? Infinity,
    );
    const mergedMaxTokens = Math.min(
      base.constraints.maxTokens ?? Infinity,
      override.constraints.maxTokens ?? Infinity,
    );
    const mergedAllowedDomains = this.mergeAllowedDomains(
      base.constraints.allowedDomains,
      override.constraints.allowedDomains,
    );
    const mergedDeniedDomains = this.mergeDeniedDomains(
      base.constraints.deniedDomains,
      override.constraints.deniedDomains,
    );

    return {
      resources: this.intersectLists(base.resources, override.resources),
      actions: this.intersectLists(base.actions, override.actions),
      constraints: {
        ...(mergedMaxDuration !== Infinity ? { maxDurationMs: mergedMaxDuration } : {}),
        ...(mergedMaxTokens !== Infinity ? { maxTokens: mergedMaxTokens } : {}),
        ...(mergedAllowedDomains ? { allowedDomains: mergedAllowedDomains } : {}),
        ...(mergedDeniedDomains ? { deniedDomains: mergedDeniedDomains } : {}),
      },
    };
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private determineIsolationLevel(
    parent: AgentContext,
    spec: DelegationSpec,
  ): IsolationLevel {
    // Sandboxed tier always uses SANDBOXED level
    const parentSandboxTier = normalizeSandboxMode(parent.sandboxTier);
    if (parentSandboxTier === "workspace_write" || parentSandboxTier === "scoped_external_access" || parentSandboxTier === "restricted_exec") {
      return IsolationLevel.SANDBOXED;
    }

    // R26-01 fix: Guard against division by zero when parent has no actions
    const parentActionCount = parent.permissions.actions.length;
    const effectiveActionCount = this.intersectLists(
      parent.permissions.actions,
      spec.requiredPermissions.actions,
    ).length;
    const parentResourceCount = parent.permissions.resources.length;
    const effectiveResourceCount = this.intersectLists(
      parent.permissions.resources,
      spec.requiredPermissions.resources,
    ).length;

    if (parentActionCount === 0 && parentResourceCount === 0) {
      return effectiveActionCount === 0 && effectiveResourceCount === 0
        ? IsolationLevel.FULL
        : IsolationLevel.MINIMAL;
    }

    const actionRatio = parentActionCount === 0 ? 0 : effectiveActionCount / parentActionCount;
    const resourceRatio = parentResourceCount === 0 ? 0 : effectiveResourceCount / parentResourceCount;
    const durationRatio = this.computeConstraintRatio(
      parent.permissions.constraints.maxDurationMs,
      spec.requiredPermissions.constraints.maxDurationMs,
    );
    const tokenRatio = this.computeConstraintRatio(
      parent.permissions.constraints.maxTokens,
      spec.requiredPermissions.constraints.maxTokens,
    );
    const domainRatio = this.computeDomainRatio(
      parent.permissions.constraints.allowedDomains,
      spec.requiredPermissions.constraints.allowedDomains,
    );
    const permissionRatio = Math.max(actionRatio, resourceRatio, durationRatio, tokenRatio, domainRatio);

    if (permissionRatio >= 0.9) {
      return IsolationLevel.FULL;
    } else if (permissionRatio >= 0.5) {
      return IsolationLevel.PARTIAL;
    } else {
      return IsolationLevel.MINIMAL;
    }
  }

  private determineSandboxTier(
    parent: AgentContext,
    spec: DelegationSpec,
  ): AgentContext["sandboxTier"] {
    const parentSandboxTier = normalizeSandboxMode(parent.sandboxTier);
    if (parentSandboxTier === "read_only") {
      return parentSandboxTier;
    }
    const requestedActions = new Set(spec.requiredPermissions.actions.map((action) => action.toLowerCase()));
    const requestsWriteAccess = [...requestedActions].some((action) =>
      action.includes("write") || action.includes("edit") || action.includes("delete") || action.includes("create")
    );
    const requestsExecution = [...requestedActions].some((action) =>
      action.includes("exec") || action.includes("bash") || action.includes("shell") || action.includes("run")
    );
    const requestsExternalAccess = (spec.requiredPermissions.constraints.allowedDomains?.length ?? 0) > 0;

    if (!requestsWriteAccess && !requestsExecution && !requestsExternalAccess) {
      return "read_only";
    }
    if (parentSandboxTier === "scoped_external_access" && !requestsExternalAccess) {
      return requestsWriteAccess || requestsExecution ? "workspace_write" : "read_only";
    }
    return parentSandboxTier;
  }

  private narrowPermissionsInternal(
    parentPermissions: PermissionSet,
    requiredPermissions: PermissionSet,
    isolationLevel: IsolationLevel,
  ): PermissionSet {
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
        // Minimal isolation grants only explicitly requested permissions.
        return {
          resources: requiredPermissions.resources.length > 0
            ? this.intersectLists(parentPermissions.resources, requiredPermissions.resources)
            : [],
          actions: requiredPermissions.actions.length > 0
            ? this.intersectLists(parentPermissions.actions, requiredPermissions.actions)
            : [],
          constraints: this.mergeConstraints(parentPermissions.constraints, requiredPermissions.constraints),
        };

      case IsolationLevel.SANDBOXED:
        // Child gets minimal permissions with sandbox restrictions
        return {
          resources: requiredPermissions.resources.length > 0
            ? this.intersectLists(parentPermissions.resources, requiredPermissions.resources)
            : [...parentPermissions.resources],
          actions: requiredPermissions.actions.length > 0
            ? this.intersectLists(parentPermissions.actions, requiredPermissions.actions)
            : [...parentPermissions.actions],
          constraints: {
            ...this.mergeConstraints(parentPermissions.constraints, requiredPermissions.constraints),
            // Additional restrictions for sandboxed execution
            maxDurationMs: Math.min(
              parentPermissions.constraints.maxDurationMs ?? Infinity,
              requiredPermissions.constraints.maxDurationMs ?? Infinity,
              60000, // Max 60 seconds for sandboxed
            ),
          },
        };
    }
  }

  private intersectLists(parent: readonly string[], child: readonly string[]): string[] {
    return parent.filter((item) => child.includes(item));
  }

  private mergeConstraints(
    parent: PermissionSet["constraints"],
    child: PermissionSet["constraints"],
  ): PermissionSet["constraints"] {
    const mergedMaxDuration = Math.min(
      parent.maxDurationMs ?? Infinity,
      child.maxDurationMs ?? Infinity,
    );
    const mergedMaxTokens = Math.min(
      parent.maxTokens ?? Infinity,
      child.maxTokens ?? Infinity,
    );
    const mergedAllowedDomains = this.mergeAllowedDomains(
      parent.allowedDomains,
      child.allowedDomains,
    );
    const mergedDeniedDomains = this.mergeDeniedDomains(
      parent.deniedDomains,
      child.deniedDomains,
    );

    return {
      ...(mergedMaxDuration !== Infinity ? { maxDurationMs: mergedMaxDuration } : {}),
      ...(mergedMaxTokens !== Infinity ? { maxTokens: mergedMaxTokens } : {}),
      ...(mergedAllowedDomains ? { allowedDomains: mergedAllowedDomains } : {}),
      ...(mergedDeniedDomains ? { deniedDomains: mergedDeniedDomains } : {}),
    };
  }

  private mergeAllowedDomains(
    parent: readonly string[] | undefined,
    child: readonly string[] | undefined,
  ): readonly string[] | undefined {
    if (!child || child.length === 0) return parent;
    if (!parent || parent.length === 0) return child;
    return parent.filter((domain) => child.includes(domain));
  }

  private mergeDeniedDomains(
    parent: readonly string[] | undefined,
    child: readonly string[] | undefined,
  ): readonly string[] | undefined {
    if (!child || child.length === 0) return parent;
    if (!parent || parent.length === 0) return child;
    // R26-05 fix: Use union for denied domains (child OR parent), not intersection
    // This ensures denied domains are never discarded - any domain denied by either is denied
    const combined = [...parent, ...child];
    return [...new Set(combined)];
  }

  private computeConstraintRatio(parentValue: number | undefined, childValue: number | undefined): number {
    if (parentValue == null || parentValue <= 0) {
      return childValue == null ? 0 : 1;
    }
    if (childValue == null) {
      return 0;
    }
    return Math.min(1, childValue / parentValue);
  }

  private computeDomainRatio(
    parentDomains: readonly string[] | undefined,
    childDomains: readonly string[] | undefined,
  ): number {
    if (parentDomains == null || parentDomains.length === 0) {
      return childDomains == null || childDomains.length === 0 ? 0 : 1;
    }
    if (childDomains == null || childDomains.length === 0) {
      return 0;
    }
    const effectiveDomains = parentDomains.filter((domain) => childDomains.includes(domain));
    return Math.min(1, effectiveDomains.length / parentDomains.length);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createContextIsolator(): ContextIsolator {
  return new ContextIsolator();
}
