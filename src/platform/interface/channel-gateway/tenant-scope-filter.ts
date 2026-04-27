export interface PrincipalScope {
  readonly actorId: string;
  readonly tenantId: string | null;
  readonly scopes?: readonly string[];
}

export interface TaskProjectionScope {
  readonly taskId: string;
  readonly tenantId: string | null;
  readonly requiredScopes?: readonly string[];
}

export interface ScopeDecision {
  readonly allowed: boolean;
  readonly reasonCode:
    | "scope.allowed"
    | "scope.tenant_mismatch"
    | "scope.missing_required_scope"
    | "scope.task_unknown";
}

export type TaskProjectionScopeResolver = (taskId: string) => TaskProjectionScope | null;

export class TenantScopeFilter {
  public constructor(private readonly resolveTaskScope: TaskProjectionScopeResolver) {}

  public evaluate(principal: PrincipalScope, taskId: string): ScopeDecision {
    const taskScope = this.resolveTaskScope(taskId);
    if (taskScope == null) {
      return { allowed: false, reasonCode: "scope.task_unknown" };
    }

    if (principal.tenantId !== taskScope.tenantId) {
      return { allowed: false, reasonCode: "scope.tenant_mismatch" };
    }

    const requiredScopes = taskScope.requiredScopes ?? [];
    if (requiredScopes.length > 0) {
      const grantedScopes = new Set(principal.scopes ?? []);
      const missingScope = requiredScopes.some((scope) => !grantedScopes.has(scope));
      if (missingScope) {
        return { allowed: false, reasonCode: "scope.missing_required_scope" };
      }
    }

    return { allowed: true, reasonCode: "scope.allowed" };
  }
}
