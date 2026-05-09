import { z } from "zod";

export const QuotaPolicySchema = z.object({
  scope: z.string().min(1).default("tenant"),
  scopeId: z.string().min(1).optional(),
  resourceType: z.string().min(1).default("runtime_units"),
  hardLimit: z.number().nonnegative(),
  softLimit: z.number().nonnegative().optional(),
  burstLimit: z.number().nonnegative().optional(),
  resetWindow: z.string().min(1).default("1h"),
  currentUsage: z.number().nonnegative(),
});

export type QuotaPolicy = z.input<typeof QuotaPolicySchema>;

const QuotaDimensionSchema = z.object({
  hardLimit: z.number().nonnegative(),
  softLimit: z.number().nonnegative().optional(),
  burstLimit: z.number().nonnegative().optional(),
  currentUsage: z.number().nonnegative(),
});

export const MultiResourceQuotaVectorSchema = z.object({
  scope: z.string().min(1).default("tenant"),
  scopeId: z.string().min(1).optional(),
  workerUnits: QuotaDimensionSchema.optional(),
  qps: QuotaDimensionSchema.optional(),
  tpm: QuotaDimensionSchema.optional(),
  budgetUsd: QuotaDimensionSchema.optional(),
  storageGb: QuotaDimensionSchema.optional(),
});

export type MultiResourceQuotaVector = z.input<typeof MultiResourceQuotaVectorSchema>;

export interface QuotaDecision {
  readonly exceeded: boolean;
  readonly warning: boolean;
  readonly usesBurst: boolean;
  readonly remainingUnits: number;
}

export interface MultiResourceQuotaDecision {
  readonly exceeded: boolean;
  readonly warning: boolean;
  readonly usesBurst: boolean;
  readonly exceededDimensions: readonly string[];
  readonly warningDimensions: readonly string[];
  readonly burstDimensions: readonly string[];
  readonly remainingByDimension: Readonly<Record<string, number>>;
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

export function isQuotaExceeded(policy: QuotaPolicy, requestedUnits: number): boolean {
  return evaluateQuota(policy, requestedUnits).exceeded;
}

export function evaluateMultiDimensionalQuota(
  vector: MultiResourceQuotaVector,
  requestedUnits: Partial<Record<keyof Omit<MultiResourceQuotaVector, "scope" | "scopeId">, number>>,
): MultiResourceQuotaDecision {
  const remainingByDimension: Record<string, number> = {};
  const exceededDimensions: string[] = [];
  const warningDimensions: string[] = [];
  const burstDimensions: string[] = [];

  for (const dimension of ["workerUnits", "qps", "tpm", "budgetUsd", "storageGb"] as const) {
    const policy = vector[dimension];
    if (policy == null) {
      continue;
    }
    const requested = requestedUnits[dimension] ?? 0;
    const decision = evaluateQuota({
      scope: vector.scope,
      scopeId: vector.scopeId,
      resourceType: dimension,
      hardLimit: policy.hardLimit,
      softLimit: policy.softLimit,
      burstLimit: policy.burstLimit,
      currentUsage: policy.currentUsage,
      resetWindow: "1h",
    }, requested);
    remainingByDimension[dimension] = decision.remainingUnits;
    if (decision.exceeded) {
      exceededDimensions.push(dimension);
    }
    if (decision.warning) {
      warningDimensions.push(dimension);
    }
    if (decision.usesBurst) {
      burstDimensions.push(dimension);
    }
  }

  return {
    exceeded: exceededDimensions.length > 0,
    warning: warningDimensions.length > 0,
    usesBurst: burstDimensions.length > 0,
    exceededDimensions,
    warningDimensions,
    burstDimensions,
    remainingByDimension,
  };
}

export function isMultiDimensionalQuotaExceeded(
  vector: MultiResourceQuotaVector,
  requestedUnits: Partial<Record<keyof Omit<MultiResourceQuotaVector, "scope" | "scopeId">, number>>,
): boolean {
  return evaluateMultiDimensionalQuota(vector, requestedUnits).exceeded;
}
