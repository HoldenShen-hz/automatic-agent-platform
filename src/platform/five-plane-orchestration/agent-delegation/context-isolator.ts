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
    const requiredActionCount = spec.requiredPermissions.actions.length;

    if (parentActionCount === 0) {
      // No actions to delegate - cannot delegate anything
      return requiredActionCount === 0 ? IsolationLevel.FULL : IsolationLevel.MINIMAL;
    }

    const permissionRatio = requiredActionCount / parentActionCount;

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
    _spec: DelegationSpec,
  ): AgentContext["sandboxTier"] {
    // Child sandbox tier is determined by parent's sandbox tier
    // Child cannot have more privilege than parent
    return normalizeSandboxMode(parent.sandboxTier);
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
        // Empty required permissions mean inherit parent scope for that dimension;
        // non-empty requests are still narrowed to the parent subset.
        return {
          resources: requiredPermissions.resources.length > 0
            ? this.intersectLists(parentPermissions.resources, requiredPermissions.resources)
            : [...parentPermissions.resources],
          actions: requiredPermissions.actions.length > 0
            ? this.intersectLists(parentPermissions.actions, requiredPermissions.actions)
            : [...parentPermissions.actions],
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

  private mergeActions(parent: readonly string[], child: readonly string[]): string[] {
    if (child.length === 0) {
      return [...parent];
    }
    return parent.filter((action) => child.includes(action));
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createContextIsolator(): ContextIsolator {
  return new ContextIsolator();
}
