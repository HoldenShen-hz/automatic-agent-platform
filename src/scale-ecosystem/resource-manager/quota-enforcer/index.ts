import { z } from "zod";

export const MultiResourceQuotaVectorSchema = z.object({
  worker_concurrency: z.number().int().nonnegative().default(0),
  tool_qps: z.number().int().nonnegative().default(0),
  model_tpm: z.number().int().nonnegative().default(0),
  model_rpm: z.number().int().nonnegative().default(0),
  budget_amount: z.number().nonnegative().default(0),
  approval_capacity: z.number().int().nonnegative().default(0),
  storage_io: z.number().int().nonnegative().default(0),
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
  const exceeded = projected > burstLimit;
  return {
    exceeded,
    warning: projected > softLimit,
    usesBurst: projected > hardLimit && projected <= burstLimit,
    remainingUnits: Math.max(0, burstLimit - projected),
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
   */
  public checkQuota(
    scope: string,
    scopeId: string,
    requested: MultiResourceQuotaVector,
  ): MultiDimensionalQuotaDecision {
    const policy = this.quotaPolicies.get(this.buildKey(scope, scopeId));
    if (!policy) {
      // No policy registered - allow by default
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

  private buildKey(scope: string, scopeId: string): string {
    return `${scope}:${scopeId}`;
  }
}
