import { z } from "zod";

export const MultiResourceQuotaVectorSchema = z.object({
  worker_concurrency: z.number().int().nonnegative().default(0),
  tool_qps: z.number().int().nonnegative().default(0),
  model_tpm: z.number().int().nonnegative().default(0),
  model_rpm: z.number().int().nonnegative().default(0),
  budget_amount: z.number().nonnegative().default(0),
  approval_capacity: z.number().int().nonnegative().default(0),
  storage_io: z.number().int().nonnegative().default(0),
  // R15-68: Promotion budget for fair scheduling - limits task promotions from queue to active
  promotion_budget: z.number().int().nonnegative().default(0),
});

export type MultiResourceQuotaVector = z.infer<typeof MultiResourceQuotaVectorSchema>;

export const QuotaPolicySchema = z
  .object({
    scope: z.string().min(1).default("tenant"),
    scopeId: z.string().min(1).optional(),
    resourceType: z.string().min(1).default("runtime_units"),
    hardLimit: z.number().nonnegative(),
    softLimit: z.number().nonnegative().optional(),
    burstLimit: z.number().nonnegative().optional(),
    resetWindow: z.string().min(1).default("1h"),
    currentUsage: z.number().nonnegative(),
    multiResourceQuota: MultiResourceQuotaVectorSchema.optional(),
    multiResourceHardLimits: MultiResourceQuotaVectorSchema.optional(),
  })
  .refine(
    (data) => {
      // Per R13-39: scopeId is required for tenant-scoped quotas
      if (data.scope === "tenant" && data.scopeId === undefined) {
        return false;
      }
      return true;
    },
    {
      message: "scopeId is required when scope is 'tenant' per §53",
      path: ["scopeId"],
    },
  );

export type QuotaPolicy = z.input<typeof QuotaPolicySchema>;

export interface QuotaDecision {
  readonly exceeded: boolean;
  readonly warning: boolean;
  readonly usesBurst: boolean;
  readonly remainingUnits: number;
}

export interface MultiDimensionalQuotaDecision {
  readonly passed: boolean;
  readonly failedDimensions: readonly string[];
  readonly warningDimensions: readonly string[];
  readonly overallDecision: QuotaDecision;
}

export function evaluateQuota(policy: QuotaPolicy, requestedUnits: number): QuotaDecision {
  const projected = policy.currentUsage + requestedUnits;
  const hardLimit = policy.hardLimit;
  const softLimit = policy.softLimit ?? hardLimit;
  const burstLimit = policy.burstLimit ?? hardLimit;
  // R24-7 FIX: Rejection (exceeded) must use hardLimit, not burstLimit.
  // hardLimit is the absolute maximum - exceeding it means the request must be rejected.
  // burstLimit is for burst/warning behavior - exceeded only means burst usage occurred.
  const exceeded = projected > hardLimit;
  return {
    exceeded,
    warning: projected > softLimit,
    // R24-07 FIX: usesBurst indicates burst capacity consumption (softLimit < projected <= hardLimit),
    // not exceeding hardLimit. The burst zone is between soft and hard limits.
    usesBurst: projected > softLimit && projected <= hardLimit,
    remainingUnits: Math.max(0, hardLimit - projected),
  };
}

export function evaluateMultiDimensionalQuota(
  policy: QuotaPolicy,
  requested: MultiResourceQuotaVector,
): MultiDimensionalQuotaDecision {
  const hardLimits = policy.multiResourceHardLimits;
  if (hardLimits == null) {
    const singleDecision = evaluateQuota(policy, requested.worker_concurrency);
    return {
      passed: !singleDecision.exceeded,
      failedDimensions: singleDecision.exceeded ? ["worker_concurrency"] : [],
      warningDimensions: singleDecision.warning ? ["worker_concurrency"] : [],
      overallDecision: singleDecision,
    };
  }

  const failedDimensions: string[] = [];
  const warningDimensions: string[] = [];

  const dimensionKeys: (keyof MultiResourceQuotaVector)[] = [
    "worker_concurrency",
    "tool_qps",
    "model_tpm",
    "model_rpm",
    "budget_amount",
    "approval_capacity",
    "storage_io",
    "promotion_budget",
  ];

  for (const dim of dimensionKeys) {
    const requestedVal = requested[dim];
    const hardLimit = hardLimits[dim] ?? 0;
    const softLimit = hardLimit * 0.8;
    if (requestedVal > hardLimit) {
      failedDimensions.push(dim);
    } else if (requestedVal > softLimit) {
      warningDimensions.push(dim);
    }
  }

  const overallDecision: QuotaDecision = {
    exceeded: failedDimensions.length > 0,
    warning: warningDimensions.length > 0 && failedDimensions.length === 0,
    usesBurst: false,
    remainingUnits: 0,
  };

  return {
    passed: failedDimensions.length === 0,
    failedDimensions,
    warningDimensions,
    overallDecision,
  };
}

export function isQuotaExceeded(policy: QuotaPolicy, requestedUnits: number): boolean {
  return evaluateQuota(policy, requestedUnits).exceeded;
}

// R13-31 FIX: Scope compatibility validation - prevents tenantId:null bypass
export interface ScopeCompatibilityResult {
  readonly compatible: boolean;
  readonly requiresExplicitPolicy: boolean;
  readonly reason: string;
}

/**
 * Validates scope compatibility - ensures tenant-scoped requests cannot bypass
 * quota checks by using null tenantId.
 *
 * R13-31 FIX: Per §53, tenant-scoped resources require explicit quota policy registration.
 * A null tenantId does NOT grant permission to bypass quota enforcement.
 */
export function scopeCompatibility(
  scope: string,
  scopeId: string | null,
  requested: MultiResourceQuotaVector,
): ScopeCompatibilityResult {
  // Tenant-scoped requests with null tenantId bypass security check - reject
  if (scope === "tenant" && scopeId === null) {
    return {
      compatible: false,
      requiresExplicitPolicy: true,
      reason: "Tenant-scoped quota requires non-null tenantId per §53",
    };
  }

  // Tenant-scoped with valid tenantId requires registered policy
  if (scope === "tenant" && scopeId !== null) {
    return {
      compatible: true,
      requiresExplicitPolicy: true,
      reason: "Tenant-scoped quota requires registered policy",
    };
  }

  // Workspace-scoped requests also require non-null workspaceId
  if (scope === "workspace" && scopeId === null) {
    return {
      compatible: false,
      requiresExplicitPolicy: true,
      reason: "Workspace-scoped quota requires non-null workspaceId",
    };
  }

  // Organization-scoped requests require non-null orgId
  if (scope === "organization" && scopeId === null) {
    return {
      compatible: false,
      requiresExplicitPolicy: true,
      reason: "Organization-scoped quota requires non-null organizationId",
    };
  }

  return {
    compatible: true,
    requiresExplicitPolicy: false,
    reason: "Scope is valid for quota enforcement",
  };
}

/**
 * Quota enforcement service per §53.2
 * Enforces MultiResourceQuotaVector limits across all resource dimensions
 */
export class QuotaEnforcerService {
  private readonly quotaPolicies = new Map<string, QuotaPolicy>();

  /**
   * Register a quota policy for enforcement
   */
  public registerQuota(scope: string, scopeId: string, policy: QuotaPolicy): void {
    const key = this.buildKey(scope, scopeId);
    this.quotaPolicies.set(key, policy);
  }

  /**
   * Check if a multi-resource request would exceed quota limits
   * R13-31 FIX: Enforces scope compatibility to prevent null tenantId bypass
   * R13-32 FIX: Rejects tenant-scoped requests without registered policy
   */
  public checkQuota(
    scope: string,
    scopeId: string | null,
    requested: MultiResourceQuotaVector,
  ): MultiDimensionalQuotaDecision {
    // R13-31 FIX: Validate scope compatibility first
    const scopeCheck = scopeCompatibility(scope, scopeId, requested);
    if (!scopeCheck.compatible) {
      return {
        passed: false,
        failedDimensions: ["scope_compatibility"],
        warningDimensions: [],
        overallDecision: {
          exceeded: true,
          warning: false,
          usesBurst: false,
          remainingUnits: 0,
        },
      };
    }

    // Only check for registered policy if scopeId is not null
    const policy = scopeId !== null ? this.quotaPolicies.get(this.buildKey(scope, scopeId)) : null;

    // R13-32 FIX: Tenant-scoped quotas require explicit policy registration
    // Do not allow bypass when scope requires explicit policy
    if (!policy && scopeCheck.requiresExplicitPolicy) {
      return {
        passed: false,
        failedDimensions: ["quota_not_registered"],
        warningDimensions: [],
        overallDecision: {
          exceeded: true,
          warning: false,
          usesBurst: false,
          remainingUnits: 0,
        },
      };
    }

    if (!policy) {
      // No policy registered for non-tenant scopes - allow by default
      return {
        passed: true,
        failedDimensions: [],
        warningDimensions: [],
        overallDecision: {
          exceeded: false,
          warning: false,
          usesBurst: false,
          remainingUnits: Infinity,
        },
      };
    }
    return evaluateMultiDimensionalQuota(policy, requested);
  }

  /**
   * Check if a single resource request would exceed quota
   */
  public checkSingleResourceQuota(
    scope: string,
    scopeId: string,
    resourceType: string,
    requestedUnits: number,
  ): QuotaDecision {
    const policy = this.quotaPolicies.get(this.buildKey(scope, scopeId));
    if (!policy) {
      return {
        exceeded: false,
        warning: false,
        usesBurst: false,
        remainingUnits: Infinity,
      };
    }
    return evaluateQuota(policy, requestedUnits);
  }

  /**
   * Update current usage for a quota policy
   */
  public updateUsage(
    scope: string,
    scopeId: string,
    additionalUsage: Partial<MultiResourceQuotaVector>,
  ): void {
    const key = this.buildKey(scope, scopeId);
    const policy = this.quotaPolicies.get(key);
    if (policy) {
      this.quotaPolicies.set(key, {
        ...policy,
        currentUsage: policy.currentUsage + (additionalUsage.worker_concurrency ?? 0),
      });
    }
  }

  private buildKey(scope: string, scopeId: string | null): string {
    return `${scope}:${scopeId ?? "null"}`;
  }
}
