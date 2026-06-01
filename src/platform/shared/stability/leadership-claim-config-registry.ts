import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isPlainObject,
  parseLimitedYaml,
  toObjectArray,
  toStringArray,
} from "../../../domains/governance/division-loader-support.js";

export type LeadershipClaimLevel =
  | "designed"
  | "pilot_ready"
  | "local_leader"
  | "industry_comparable"
  | "industry_leading"
  | (string & {});

export type LeadershipClaimStatus = "draft" | "approved" | "expired" | "revoked" | "rejected" | (string & {});
export type LeadershipClaimSurface = "docs" | "ui" | "release_note" | "sales_material" | (string & {});
export type FamilyReadinessStatus = "governance_ready" | "pilot_ready" | "local_leadership_ready" | "industry_ready" | (string & {});

export interface LeadershipBenchmark {
  readonly benchmarkId: string;
  readonly label: string;
  readonly url: string;
  readonly purpose: string;
}

export interface LeadershipMetricMapping {
  readonly metricId: string;
  readonly description: string;
}

export interface LeadershipEvidenceThreshold {
  readonly label: string;
  readonly requirement: string;
}

export interface FamilyLeadershipReadiness {
  readonly familyId: string;
  readonly displayName: string;
  readonly readinessStatus: FamilyReadinessStatus;
  readonly targetClaimLevel: LeadershipClaimLevel;
  readonly owner: string;
  readonly canonicalFamilies: readonly string[];
  readonly canonicalDivisions: readonly string[];
  readonly benchmarkRefs: readonly string[];
  readonly minimumEvidenceRef: string;
  readonly notes: string;
  readonly benchmarks: readonly LeadershipBenchmark[];
  readonly internalMappings: readonly LeadershipMetricMapping[];
  readonly mvpThresholds: readonly LeadershipEvidenceThreshold[];
  readonly leadershipThresholds: readonly LeadershipEvidenceThreshold[];
}

export interface LeadershipClaimRecord {
  readonly claimId: string;
  readonly familyId: string;
  readonly divisionId: string | null;
  readonly scenarioId: string | null;
  readonly claimLevel: LeadershipClaimLevel;
  readonly claimText: string;
  readonly allowedSurfaces: readonly LeadershipClaimSurface[];
  readonly evidenceRefs: readonly string[];
  readonly reviewedBy: readonly string[];
  readonly expiresAt: string | null;
  readonly status: LeadershipClaimStatus;
}

export interface LeadershipClaimAllowlistEntry {
  readonly filePath: string;
  readonly matchedText: string;
  readonly reason: string;
  readonly owner: string;
  readonly expiresAt: string | null;
  readonly expired: boolean;
}

export interface LeadershipClaimConfigRegistryOptions {
  readonly platformRoot?: string;
  readonly configRoot?: string;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeIsoOrNull(value: unknown): string | null {
  const candidate = toNullableString(value);
  if (candidate == null) {
    return null;
  }
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function isExpired(iso: string | null, now: Date): boolean {
  return iso != null && Date.parse(iso) < now.getTime();
}

function toThresholds(value: unknown): LeadershipEvidenceThreshold[] {
  return toObjectArray(value).map((entry) => ({
    label: typeof entry.label === "string" ? entry.label : "unnamed-threshold",
    requirement: typeof entry.requirement === "string" ? entry.requirement : "unspecified",
  }));
}

function toBenchmarkEntries(value: unknown): LeadershipBenchmark[] {
  return toObjectArray(value).map((entry) => ({
    benchmarkId: typeof entry.benchmarkId === "string" ? entry.benchmarkId : "unknown-benchmark",
    label: typeof entry.label === "string" ? entry.label : "Unnamed benchmark",
    url: typeof entry.url === "string" ? entry.url : "",
    purpose: typeof entry.purpose === "string" ? entry.purpose : "",
  }));
}

function toMetricMappings(value: unknown): LeadershipMetricMapping[] {
  return toObjectArray(value).map((entry) => ({
    metricId: typeof entry.metricId === "string" ? entry.metricId : "unknown-metric",
    description: typeof entry.description === "string" ? entry.description : "",
  }));
}

function resolvePlatformRoot(platformRoot?: string): string {
  return platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

export class LeadershipClaimConfigRegistry {
  private readonly configRoot: string;

  public constructor(options: LeadershipClaimConfigRegistryOptions = {}) {
    const platformRoot = resolvePlatformRoot(options.platformRoot);
    this.configRoot = options.configRoot ?? join(platformRoot, "config", "division-coverage");
  }

  public listFamilyReadiness(): FamilyLeadershipReadiness[] {
    const readinessConfig = this.readYamlObject(join(this.configRoot, "family-readiness.yaml"));
    const benchmarkConfig = this.readYamlObject(join(this.configRoot, "benchmark-map.yaml"));
    const evidenceConfig = this.readYamlObject(join(this.configRoot, "minimum-leading-evidence.yaml"));
    const benchmarkByFamily = new Map<string, Record<string, unknown>>();
    const evidenceByFamily = new Map<string, Record<string, unknown>>();

    for (const family of toObjectArray(benchmarkConfig.families)) {
      if (typeof family.familyId === "string") {
        benchmarkByFamily.set(family.familyId, family);
      }
    }
    for (const family of toObjectArray(evidenceConfig.families)) {
      if (typeof family.familyId === "string") {
        evidenceByFamily.set(family.familyId, family);
      }
    }

    return toObjectArray(readinessConfig.families).map((family) => {
      const familyId = typeof family.familyId === "string" ? family.familyId : "unknown-family";
      const benchmark = benchmarkByFamily.get(familyId) ?? {};
      const evidence = evidenceByFamily.get(familyId) ?? {};
      return {
        familyId,
        displayName: typeof family.displayName === "string" ? family.displayName : familyId,
        readinessStatus: typeof family.readinessStatus === "string" ? family.readinessStatus as FamilyReadinessStatus : "governance_ready",
        targetClaimLevel: typeof family.targetClaimLevel === "string" ? family.targetClaimLevel as LeadershipClaimLevel : "designed",
        owner: typeof family.owner === "string" ? family.owner : "unassigned-owner",
        canonicalFamilies: toStringArray(family.canonicalFamilies),
        canonicalDivisions: toStringArray(family.canonicalDivisions),
        benchmarkRefs: toStringArray(family.benchmarkRefs),
        minimumEvidenceRef: typeof family.minimumEvidenceRef === "string" ? family.minimumEvidenceRef : familyId,
        notes: typeof family.notes === "string" ? family.notes : "",
        benchmarks: toBenchmarkEntries(benchmark.benchmarks),
        internalMappings: toMetricMappings(benchmark.internalMappings),
        mvpThresholds: toThresholds(evidence.mvpThresholds),
        leadershipThresholds: toThresholds(evidence.leadershipThresholds),
      };
    });
  }

  public listClaims(): LeadershipClaimRecord[] {
    const claimsConfig = this.readYamlObject(join(this.configRoot, "claims", "records.yaml"));
    return toObjectArray(claimsConfig.claims).map((claim) => ({
      claimId: typeof claim.claimId === "string" ? claim.claimId : "unknown-claim",
      familyId: typeof claim.familyId === "string" ? claim.familyId : "unknown-family",
      divisionId: toNullableString(claim.divisionId),
      scenarioId: toNullableString(claim.scenarioId),
      claimLevel: typeof claim.claimLevel === "string" ? claim.claimLevel as LeadershipClaimLevel : "designed",
      claimText: typeof claim.claimText === "string" ? claim.claimText : "",
      allowedSurfaces: toStringArray(claim.allowedSurfaces) as LeadershipClaimSurface[],
      evidenceRefs: toStringArray(claim.evidenceRefs),
      reviewedBy: toStringArray(claim.reviewedBy),
      expiresAt: normalizeIsoOrNull(claim.expiresAt),
      status: typeof claim.status === "string" ? claim.status as LeadershipClaimStatus : "draft",
    }));
  }

  public listAllowlist(now: Date = new Date()): LeadershipClaimAllowlistEntry[] {
    const allowlistConfig = this.readYamlObject(join(this.configRoot, "claims", "allowlist.yaml"));
    return toObjectArray(allowlistConfig.entries).map((entry) => {
      const expiresAt = normalizeIsoOrNull(entry.expiresAt);
      return {
        filePath: typeof entry.filePath === "string" ? entry.filePath : "",
        matchedText: typeof entry.matchedText === "string" ? entry.matchedText : "",
        reason: typeof entry.reason === "string" ? entry.reason : "unspecified",
        owner: typeof entry.owner === "string" ? entry.owner : "unassigned-owner",
        expiresAt,
        expired: isExpired(expiresAt, now),
      };
    });
  }

  private readYamlObject(path: string): Record<string, unknown> {
    const parsed = parseLimitedYaml(readFileSync(path, "utf8"), path);
    return isPlainObject(parsed) ? parsed : {};
  }
}
