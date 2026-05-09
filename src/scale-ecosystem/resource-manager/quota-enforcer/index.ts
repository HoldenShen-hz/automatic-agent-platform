import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

export const QuotaDimensionSchema = z.object({
  hardLimit: z.number().nonnegative(),
  softLimit: z.number().nonnegative().optional(),
  burstLimit: z.number().nonnegative().optional(),
  currentUsage: z.number().nonnegative().default(0),
});

export type QuotaDimension = z.infer<typeof QuotaDimensionSchema>;

const LegacyMultiResourceQuotaVectorSchema = z.object({
  worker_concurrency: z.number().nonnegative().optional(),
  tool_qps: z.number().nonnegative().optional(),
  model_tpm: z.number().nonnegative().optional(),
  model_rpm: z.number().nonnegative().optional(),
  budget_amount: z.number().nonnegative().optional(),
  approval_capacity: z.number().nonnegative().optional(),
  storage_io: z.number().nonnegative().optional(),
});

const CanonicalMultiResourceQuotaVectorSchema = z.object({
  workerUnits: QuotaDimensionSchema.optional(),
  qps: QuotaDimensionSchema.optional(),
  tpm: QuotaDimensionSchema.optional(),
  budgetUsd: QuotaDimensionSchema.optional(),
  storageGb: QuotaDimensionSchema.optional(),
  concurrentSessions: QuotaDimensionSchema.optional(),
  apiCallsPerDay: QuotaDimensionSchema.optional(),
});

export const MultiResourceQuotaVectorSchema = z.object({
  scope: z.string().min(1).default("tenant"),
  scopeId: z.string().min(1).optional(),
}).merge(LegacyMultiResourceQuotaVectorSchema).merge(CanonicalMultiResourceQuotaVectorSchema).superRefine((value, ctx) => {
  if (value.scope === "tenant" && (value.scopeId == null || value.scopeId.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scopeId"],
      message: "tenant-scoped quota vectors must bind scopeId",
    });
  }
});

export type MultiResourceQuotaVector = z.infer<typeof MultiResourceQuotaVectorSchema>;

const LegacyMultiResourceHardLimitsSchema = z.object({
  worker_concurrency: z.number().nonnegative().optional(),
  tool_qps: z.number().nonnegative().optional(),
  model_tpm: z.number().nonnegative().optional(),
  model_rpm: z.number().nonnegative().optional(),
  budget_amount: z.number().nonnegative().optional(),
  approval_capacity: z.number().nonnegative().optional(),
  storage_io: z.number().nonnegative().optional(),
});

export const QuotaPolicySchema = z.object({
  scope: z.string().min(1).default("tenant"),
  scopeId: z.string().min(1).optional(),
  resourceType: z.string().min(1).default("runtime_units"),
  hardLimit: z.number().nonnegative(),
  softLimit: z.number().nonnegative().optional(),
  burstLimit: z.number().nonnegative().optional(),
  resetWindow: z.string().min(1).default("1h"),
  currentUsage: z.number().nonnegative().default(0),
  multiResourceQuota: LegacyMultiResourceQuotaVectorSchema.optional(),
  multiResourceHardLimits: LegacyMultiResourceHardLimitsSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.scope === "tenant" && (value.scopeId == null || value.scopeId.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scopeId"],
      message: "tenant-scoped quota policies must bind scopeId",
    });
  }
});

export type QuotaPolicy = z.infer<typeof QuotaPolicySchema>;

export const QUOTA_DIMENSIONS = [
  "workerUnits",
  "qps",
  "tpm",
  "budgetUsd",
  "storageGb",
  "concurrentSessions",
  "apiCallsPerDay",
] as const;

export type QuotaDimensionKey = typeof QUOTA_DIMENSIONS[number];

const LEGACY_DIMENSIONS = [
  "worker_concurrency",
  "tool_qps",
  "model_tpm",
  "model_rpm",
  "budget_amount",
  "approval_capacity",
  "storage_io",
] as const;

type LegacyQuotaDimensionKey = typeof LEGACY_DIMENSIONS[number];
type LegacyQuotaVector = z.infer<typeof LegacyMultiResourceQuotaVectorSchema>;

export interface QuotaDecision {
  readonly exceeded: boolean;
  readonly warning: boolean;
  readonly usesBurst: boolean;
  readonly remainingUnits: number;
}

export interface MultiResourceQuotaDecision {
  readonly passed: boolean;
  readonly failedDimensions: readonly string[];
  readonly warningDimensions: readonly string[];
  readonly burstDimensions: readonly string[];
  readonly remainingByDimension: Readonly<Record<string, number>>;
  readonly overallDecision: QuotaDecision;
}

export interface QuotaCheckResult extends MultiResourceQuotaDecision {}

export interface RegisteredQuotaScope {
  readonly scope: string;
  readonly scopeId: string;
  readonly registrationKind: "legacy_policy" | "canonical_vector";
}

export interface QuotaStateSnapshot {
  readonly registrations: Readonly<Record<string, QuotaPolicy | MultiResourceQuotaVector>>;
}

export interface QuotaStateStore {
  load(): QuotaStateSnapshot;
  save(snapshot: QuotaStateSnapshot): void;
}

export class InMemoryQuotaStateStore implements QuotaStateStore {
  private snapshot: QuotaStateSnapshot = { registrations: {} };

  public load(): QuotaStateSnapshot {
    return this.snapshot;
  }

  public save(snapshot: QuotaStateSnapshot): void {
    this.snapshot = snapshot;
  }
}

export class FileQuotaStateStore implements QuotaStateStore {
  public constructor(private readonly filePath: string) {}

  public load(): QuotaStateSnapshot {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as QuotaStateSnapshot;
      return typeof parsed === "object" && parsed !== null && typeof parsed.registrations === "object" && parsed.registrations !== null
        ? parsed
        : { registrations: {} };
    } catch {
      return { registrations: {} };
    }
  }

  public save(snapshot: QuotaStateSnapshot): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), "utf8");
  }
}

function registrationKey(scope: string, scopeId: string): string {
  return `${scope}:${scopeId}`;
}

function isCanonicalQuotaDimension(value: unknown): value is QuotaDimension {
  return typeof value === "object" && value !== null && typeof (value as QuotaDimension).hardLimit === "number";
}

function isCanonicalQuotaVector(value: QuotaPolicy | MultiResourceQuotaVector): value is MultiResourceQuotaVector {
  return QUOTA_DIMENSIONS.some((dimension) => isCanonicalQuotaDimension((value as MultiResourceQuotaVector)[dimension]));
}

function toQuotaDecision(
  hardLimit: number,
  currentUsage: number,
  requestedUnits: number,
  softLimit?: number,
  burstLimit?: number,
): QuotaDecision {
  const projected = currentUsage + requestedUnits;
  const effectiveSoftLimit = softLimit ?? hardLimit;
  const effectiveBurstLimit = burstLimit ?? hardLimit;
  const exceeded = projected > effectiveBurstLimit;
  return {
    exceeded,
    warning: projected > effectiveSoftLimit,
    usesBurst: projected > hardLimit && projected <= effectiveBurstLimit,
    remainingUnits: Math.max(0, effectiveBurstLimit - projected),
  };
}

export function evaluateQuota(
  dimension: QuotaDimension | QuotaPolicy,
  requestedUnits: number,
): QuotaDecision {
  if ("resourceType" in dimension) {
    return toQuotaDecision(
      dimension.hardLimit,
      dimension.currentUsage,
      requestedUnits,
      dimension.softLimit,
      dimension.burstLimit,
    );
  }

  return toQuotaDecision(
    dimension.hardLimit,
    dimension.currentUsage,
    requestedUnits,
    dimension.softLimit,
    dimension.burstLimit,
  );
}

export function isQuotaExceeded(
  dimension: QuotaDimension | QuotaPolicy,
  requestedUnits: number,
): boolean {
  return evaluateQuota(dimension, requestedUnits).exceeded;
}

function evaluateLegacyMultiResourceQuota(
  policy: QuotaPolicy,
  requestedUnits: Partial<LegacyQuotaVector>,
): MultiResourceQuotaDecision {
  const failedDimensions: string[] = [];
  const warningDimensions: string[] = [];
  const burstDimensions: string[] = [];
  const remainingByDimension: Record<string, number> = {};

  for (const dimension of LEGACY_DIMENSIONS) {
    const hardLimit = policy.multiResourceHardLimits?.[dimension];
    if (hardLimit == null) {
      continue;
    }
    const currentUsage = policy.multiResourceQuota?.[dimension] ?? 0;
    const requested = requestedUnits[dimension] ?? 0;
    const projected = currentUsage + requested;
    const softLimit = hardLimit * 0.8;
    const exceeded = projected >= hardLimit;
    const warning = !exceeded && projected >= softLimit;

    remainingByDimension[dimension] = Math.max(0, hardLimit - projected);
    if (exceeded) {
      failedDimensions.push(dimension);
      continue;
    }
    if (warning) {
      warningDimensions.push(dimension);
    }
    if (projected > hardLimit) {
      burstDimensions.push(dimension);
    }
  }

  return {
    passed: failedDimensions.length === 0,
    failedDimensions,
    warningDimensions,
    burstDimensions,
    remainingByDimension,
    overallDecision: {
      exceeded: failedDimensions.length > 0,
      warning: warningDimensions.length > 0,
      usesBurst: burstDimensions.length > 0,
      remainingUnits: failedDimensions.length > 0
        ? 0
        : Math.min(...Object.values(remainingByDimension).concat(Number.POSITIVE_INFINITY)),
    },
  };
}

function evaluateCanonicalMultiResourceQuota(
  vector: MultiResourceQuotaVector,
  requestedUnits: Partial<Record<QuotaDimensionKey, number>>,
): MultiResourceQuotaDecision {
  const failedDimensions: string[] = [];
  const warningDimensions: string[] = [];
  const burstDimensions: string[] = [];
  const remainingByDimension: Record<string, number> = {};

  for (const dimension of QUOTA_DIMENSIONS) {
    const quota = vector[dimension];
    if (!isCanonicalQuotaDimension(quota)) {
      continue;
    }
    const decision = evaluateQuota(quota, requestedUnits[dimension] ?? 0);
    remainingByDimension[dimension] = decision.remainingUnits;
    if (decision.exceeded) {
      failedDimensions.push(dimension);
    } else if (decision.warning) {
      warningDimensions.push(dimension);
    }
    if (decision.usesBurst) {
      burstDimensions.push(dimension);
    }
  }

  return {
    passed: failedDimensions.length === 0,
    failedDimensions,
    warningDimensions,
    burstDimensions,
    remainingByDimension,
    overallDecision: {
      exceeded: failedDimensions.length > 0,
      warning: warningDimensions.length > 0,
      usesBurst: burstDimensions.length > 0,
      remainingUnits: failedDimensions.length > 0
        ? 0
        : Math.min(...Object.values(remainingByDimension).concat(Number.POSITIVE_INFINITY)),
    },
  };
}

export function evaluateMultiDimensionalQuota(
  vectorOrPolicy: MultiResourceQuotaVector | QuotaPolicy,
  requestedUnits: Partial<Record<string, number>>,
): MultiResourceQuotaDecision {
  if (isCanonicalQuotaVector(vectorOrPolicy)) {
    return evaluateCanonicalMultiResourceQuota(
      vectorOrPolicy,
      requestedUnits as Partial<Record<QuotaDimensionKey, number>>,
    );
  }

  if (vectorOrPolicy.multiResourceHardLimits != null) {
    return evaluateLegacyMultiResourceQuota(
      vectorOrPolicy,
      requestedUnits as Partial<LegacyQuotaVector>,
    );
  }

  const requestValue = Object.values(requestedUnits)[0] ?? 0;
  const overallDecision = evaluateQuota(vectorOrPolicy, requestValue);
  return {
    passed: !overallDecision.exceeded,
    failedDimensions: overallDecision.exceeded ? [vectorOrPolicy.resourceType] : [],
    warningDimensions: overallDecision.warning ? [vectorOrPolicy.resourceType] : [],
    burstDimensions: overallDecision.usesBurst ? [vectorOrPolicy.resourceType] : [],
    remainingByDimension: { [vectorOrPolicy.resourceType]: overallDecision.remainingUnits },
    overallDecision,
  };
}

export function isMultiDimensionalQuotaExceeded(
  vectorOrPolicy: MultiResourceQuotaVector | QuotaPolicy,
  requestedUnits: Partial<Record<string, number>>,
): boolean {
  return !evaluateMultiDimensionalQuota(vectorOrPolicy, requestedUnits).passed;
}

export class QuotaEnforcerService {
  private readonly registrations = new Map<string, QuotaPolicy | MultiResourceQuotaVector>();

  public constructor(private readonly stateStore: QuotaStateStore = new InMemoryQuotaStateStore()) {
    for (const [key, value] of Object.entries(this.stateStore.load().registrations)) {
      this.registrations.set(key, value);
    }
  }

  public registerTenant(tenantId: string, quota: Omit<MultiResourceQuotaVector, "scope" | "scopeId">): MultiResourceQuotaVector {
    const registered = MultiResourceQuotaVectorSchema.parse({
      scope: "tenant",
      scopeId: tenantId,
      ...quota,
    });
    this.registrations.set(registrationKey("tenant", tenantId), registered);
    this.persist();
    return registered;
  }

  public registerQuota(scope: string, scopeId: string, policy: QuotaPolicy | MultiResourceQuotaVector): QuotaPolicy | MultiResourceQuotaVector {
    const normalized = isCanonicalQuotaVector(policy)
      ? MultiResourceQuotaVectorSchema.parse({ scope, scopeId, ...policy })
      : QuotaPolicySchema.parse({ scope, scopeId, ...policy });
    this.registrations.set(registrationKey(scope, scopeId), normalized);
    this.persist();
    return normalized;
  }

  public getQuota(scope: string, scopeId: string): QuotaPolicy | MultiResourceQuotaVector | null {
    return this.registrations.get(registrationKey(scope, scopeId)) ?? null;
  }

  public listRegistrations(): readonly RegisteredQuotaScope[] {
    return [...this.registrations.entries()].map(([key, value]) => {
      const separatorIndex = key.indexOf(":");
      const scope = separatorIndex === -1 ? key : key.slice(0, separatorIndex);
      const scopeId = separatorIndex === -1 ? "" : key.slice(separatorIndex + 1);
      return {
        scope,
        scopeId,
        registrationKind: isCanonicalQuotaVector(value) ? "canonical_vector" : "legacy_policy",
      };
    });
  }

  public checkQuota(scope: string, scopeId: string, requestedUnits: Partial<Record<string, number>>): QuotaCheckResult {
    const quota = this.registrations.get(registrationKey(scope, scopeId));
    if (quota == null) {
      return {
        passed: true,
        failedDimensions: [],
        warningDimensions: [],
        burstDimensions: [],
        remainingByDimension: {},
        overallDecision: {
          exceeded: false,
          warning: false,
          usesBurst: false,
          remainingUnits: Number.POSITIVE_INFINITY,
        },
      };
    }

    return evaluateMultiDimensionalQuota(quota, requestedUnits);
  }

  public checkSingleResourceQuota(
    scope: string,
    scopeId: string,
    _resourceType: string,
    requestedUnits: number,
  ): QuotaDecision {
    const quota = this.registrations.get(registrationKey(scope, scopeId));
    if (quota == null) {
      return {
        exceeded: false,
        warning: false,
        usesBurst: false,
        remainingUnits: Number.POSITIVE_INFINITY,
      };
    }

    if (isCanonicalQuotaVector(quota)) {
      const dimension = quota.workerUnits;
      if (!isCanonicalQuotaDimension(dimension)) {
        return {
          exceeded: false,
          warning: false,
          usesBurst: false,
          remainingUnits: Number.POSITIVE_INFINITY,
        };
      }
      return evaluateQuota(dimension, requestedUnits);
    }

    return evaluateQuota(quota, requestedUnits);
  }

  public updateUsage(scope: string, scopeId: string, usageDelta: Partial<Record<string, number>>): void {
    const key = registrationKey(scope, scopeId);
    const quota = this.registrations.get(key);
    if (quota == null) {
      return;
    }

    if (isCanonicalQuotaVector(quota)) {
      const updated: MultiResourceQuotaVector = { ...quota };
      for (const dimension of QUOTA_DIMENSIONS) {
        const delta = usageDelta[dimension];
        const current = updated[dimension];
        if (delta == null || !isCanonicalQuotaDimension(current)) {
          continue;
        }
        updated[dimension] = {
          ...current,
          currentUsage: current.currentUsage + delta,
        };
      }
      this.registrations.set(key, updated);
      this.persist();
      return;
    }

    const nextMultiResourceUsage: LegacyQuotaVector = {
      ...(quota.multiResourceQuota ?? {}),
    };
    let totalDelta = 0;
    for (const [dimension, value] of Object.entries(usageDelta)) {
      if (typeof value !== "number" || !LEGACY_DIMENSIONS.includes(dimension as LegacyQuotaDimensionKey)) {
        continue;
      }
      nextMultiResourceUsage[dimension as LegacyQuotaDimensionKey] = (nextMultiResourceUsage[dimension as LegacyQuotaDimensionKey] ?? 0) + value;
      totalDelta += value;
    }

    this.registrations.set(key, {
      ...quota,
      currentUsage: quota.currentUsage + totalDelta,
      multiResourceQuota: nextMultiResourceUsage,
    });
    this.persist();
  }

  public exportSnapshot(): QuotaStateSnapshot {
    const registrations: Record<string, QuotaPolicy | MultiResourceQuotaVector> = {};
    for (const [key, value] of this.registrations.entries()) {
      registrations[key] = value;
    }
    return { registrations };
  }

  private persist(): void {
    this.stateStore.save(this.exportSnapshot());
  }
}
