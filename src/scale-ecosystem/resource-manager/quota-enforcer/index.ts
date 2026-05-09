import { z } from "zod";

export const QuotaDimensionSchema = z.object({
  hardLimit: z.number().nonnegative(),
  softLimit: z.number().nonnegative().optional(),
  burstLimit: z.number().nonnegative().optional(),
  currentUsage: z.number().nonnegative(),
});

export type QuotaDimension = z.input<typeof QuotaDimensionSchema>;

/** Supported quota dimensions (7 total) */
export const QUOTA_DIMENSIONS = ["workerUnits", "qps", "tpm", "budgetUsd", "storageGb", "concurrentSessions", "apiCallsPerDay"] as const;
export type QuotaDimensionKey = typeof QUOTA_DIMENSIONS[number];

export const MultiResourceQuotaVectorSchema = z.object({
  scope: z.string().min(1).default("tenant"),
  scopeId: z.string().min(1).optional(),
  workerUnits: QuotaDimensionSchema.optional(),
  qps: QuotaDimensionSchema.optional(),
  tpm: QuotaDimensionSchema.optional(),
  budgetUsd: QuotaDimensionSchema.optional(),
  storageGb: QuotaDimensionSchema.optional(),
  /** Concurrent active session count */
  concurrentSessions: QuotaDimensionSchema.optional(),
  /** Daily API call quota */
  apiCallsPerDay: QuotaDimensionSchema.optional(),
});

export type MultiResourceQuotaVector = z.input<typeof MultiResourceQuotaVectorSchema>;

/**
 * Unified quota policy - always 7-dimensional (MultiResourceQuotaVector).
 * Single-dimension quota evaluation uses evaluateQuota() directly.
 */
export const QuotaPolicySchema = MultiResourceQuotaVectorSchema;

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

/**
 * Evaluate a single dimension quota against a quota dimension (hardLimit/softLimit/burstLimit/currentUsage).
 */
export function evaluateQuota(dimension: QuotaDimension, requestedUnits: number): QuotaDecision {
  const projected = dimension.currentUsage + requestedUnits;
  const hardLimit = dimension.hardLimit;
  const softLimit = dimension.softLimit ?? hardLimit;
  const burstLimit = dimension.burstLimit ?? hardLimit;
  // Use hardLimit as the rejection threshold - if projected exceeds hardLimit, reject
  const exceeded = projected > hardLimit;
  return {
    exceeded,
    warning: projected > softLimit,
    usesBurst: projected > hardLimit && projected <= burstLimit,
    remainingUnits: Math.max(0, hardLimit - projected),
  };
}

export function isQuotaExceeded(dimension: QuotaDimension, requestedUnits: number): boolean {
  return evaluateQuota(dimension, requestedUnits).exceeded;
}

export function evaluateMultiDimensionalQuota(
  vector: MultiResourceQuotaVector,
  requestedUnits: Partial<Record<keyof Omit<MultiResourceQuotaVector, "scope" | "scopeId">, number>>,
): MultiResourceQuotaDecision {
  const remainingByDimension: Record<string, number> = {};
  const exceededDimensions: string[] = [];
  const warningDimensions: string[] = [];
  const burstDimensions: string[] = [];

  for (const dimension of QUOTA_DIMENSIONS) {
    const dim = vector[dimension];
    if (dim == null) {
      continue;
    }
    const requested = requestedUnits[dimension] ?? 0;
    const decision = evaluateQuota(dim, requested);
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
