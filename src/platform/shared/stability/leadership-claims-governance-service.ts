import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  isPlainObject,
  parseLimitedYaml,
  toObjectArray,
  toStringArray,
} from "../../../domains/governance/division-loader-support.js";

type LeadershipClaimLevel =
  | "designed"
  | "pilot_ready"
  | "local_leader"
  | "industry_comparable"
  | "industry_leading"
  | (string & {});

type LeadershipClaimStatus = "draft" | "approved" | "expired" | "revoked" | "rejected" | (string & {});
type LeadershipClaimSurface = "docs" | "ui" | "release_note" | "sales_material" | (string & {});
type FamilyReadinessStatus = "governance_ready" | "pilot_ready" | "local_leadership_ready" | "industry_ready" | (string & {});

export interface LeadershipClaimScannerHit {
  readonly filePath: string;
  readonly matchedText: string;
  readonly lineNumber: number;
  readonly excerpt: string;
  readonly surface: LeadershipClaimSurface;
  readonly status: "blocked" | "allowlisted" | "expired_allowlist" | "approved_claim";
  readonly claimId: string | null;
  readonly reason: string | null;
}

export interface LeadershipClaimReviewRequest {
  readonly requestId: string;
  readonly familyId: string;
  readonly divisionId: string | null;
  readonly scenarioId: string | null;
  readonly requestedClaimLevel: LeadershipClaimLevel;
  readonly requestedSurfaces: readonly LeadershipClaimSurface[];
  readonly requestedBy: string;
  readonly rationale: string;
  readonly requestedAt: string;
  readonly status: "pending" | "approved" | "rejected";
}

interface LeadershipBenchmark {
  readonly benchmarkId: string;
  readonly label: string;
  readonly url: string;
  readonly purpose: string;
}

interface LeadershipMetricMapping {
  readonly metricId: string;
  readonly description: string;
}

interface LeadershipEvidenceThreshold {
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
  readonly effectiveStatus: LeadershipClaimStatus;
}

export interface LeadershipClaimAllowlistEntry {
  readonly filePath: string;
  readonly matchedText: string;
  readonly reason: string;
  readonly owner: string;
  readonly expiresAt: string | null;
  readonly expired: boolean;
}

export interface LeadershipNoGoAction {
  readonly familyId: string | null;
  readonly id: string;
  readonly description: string;
  readonly riskClass: string;
  readonly scopes: readonly string[];
  readonly enforcementSurfaces: readonly string[];
  readonly blockModes: readonly string[];
}

export interface LeadershipClaimsConsoleSnapshot {
  readonly generatedAt: string;
  readonly families: readonly FamilyLeadershipReadiness[];
  readonly claims: readonly LeadershipClaimRecord[];
  readonly allowlist: readonly LeadershipClaimAllowlistEntry[];
  readonly scannerHits: readonly LeadershipClaimScannerHit[];
  readonly scannerGeneratedAt: string | null;
  readonly reviewRequests: readonly LeadershipClaimReviewRequest[];
  readonly noGoActions: readonly LeadershipNoGoAction[];
  readonly summary: {
    readonly familyCount: number;
    readonly approvedClaimCount: number;
    readonly expiringClaimCount: number;
    readonly pendingReviewRequestCount: number;
    readonly blockedScannerHitCount: number;
    readonly expiredAllowlistCount: number;
  };
}

export interface LeadershipClaimsGovernanceServiceOptions {
  readonly platformRoot?: string;
  readonly dataRoot?: string;
  readonly configRoot?: string;
  readonly policyRoot?: string;
}

interface LeadershipClaimScanReport {
  readonly generatedAt: string | null;
  readonly hits: readonly LeadershipClaimScannerHit[];
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

function readJsonArray(path: string): Record<string, unknown>[] {
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return toObjectArray(parsed);
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
  if (iso == null) {
    return false;
  }
  return Date.parse(iso) < now.getTime();
}

function resolvePlatformRoot(platformRoot?: string): string {
  return platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

function resolveDataRoot(platformRoot: string, dataRoot?: string): string {
  return dataRoot ?? process.env.AA_DATA_ROOT ?? join(platformRoot, "data");
}

export class LeadershipClaimsGovernanceService {
  private readonly platformRoot: string;
  private readonly configRoot: string;
  private readonly policyRoot: string;
  private readonly governanceDataRoot: string;
  private readonly reviewRequestsPath: string;
  private readonly scanReportPath: string;

  public constructor(options: LeadershipClaimsGovernanceServiceOptions = {}) {
    this.platformRoot = resolvePlatformRoot(options.platformRoot);
    const resolvedDataRoot = resolveDataRoot(this.platformRoot, options.dataRoot);
    this.configRoot = options.configRoot ?? join(this.platformRoot, "config", "division-coverage");
    this.policyRoot = options.policyRoot ?? join(this.platformRoot, "config", "policy");
    this.governanceDataRoot = join(resolvedDataRoot, "governance");
    this.reviewRequestsPath = join(this.governanceDataRoot, "leadership-claim-review-requests.json");
    this.scanReportPath = join(this.governanceDataRoot, "leadership-claim-scan-report.json");
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

  public listClaims(now: Date = new Date()): LeadershipClaimRecord[] {
    const claimsConfig = this.readYamlObject(join(this.configRoot, "claims", "records.yaml"));
    return toObjectArray(claimsConfig.claims).map((claim) => {
      const expiresAt = normalizeIsoOrNull(claim.expiresAt);
      const rawStatus = typeof claim.status === "string" ? claim.status as LeadershipClaimStatus : "draft";
      const effectiveStatus = rawStatus === "approved" && isExpired(expiresAt, now) ? "expired" : rawStatus;
      return {
        claimId: typeof claim.claimId === "string" ? claim.claimId : "unknown-claim",
        familyId: typeof claim.familyId === "string" ? claim.familyId : "unknown-family",
        divisionId: toNullableString(claim.divisionId),
        scenarioId: toNullableString(claim.scenarioId),
        claimLevel: typeof claim.claimLevel === "string" ? claim.claimLevel as LeadershipClaimLevel : "designed",
        claimText: typeof claim.claimText === "string" ? claim.claimText : "",
        allowedSurfaces: toStringArray(claim.allowedSurfaces) as LeadershipClaimSurface[],
        evidenceRefs: toStringArray(claim.evidenceRefs),
        reviewedBy: toStringArray(claim.reviewedBy),
        expiresAt,
        status: rawStatus,
        effectiveStatus,
      };
    });
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

  public listNoGoActions(): LeadershipNoGoAction[] {
    const noGoConfig = this.readYamlObject(join(this.policyRoot, "no-go-actions.yaml"));
    const globalActions = toObjectArray(noGoConfig.globalActions).map((action) => this.mapNoGoAction(action, null));
    const familyActions = toObjectArray(noGoConfig.familyActions).flatMap((familyEntry) => {
      const familyId = typeof familyEntry.familyId === "string" ? familyEntry.familyId : null;
      return toObjectArray(familyEntry.actions).map((action) => this.mapNoGoAction(action, familyId));
    });
    return [...globalActions, ...familyActions];
  }

  public listReviewRequests(): LeadershipClaimReviewRequest[] {
    const reviewRequests: LeadershipClaimReviewRequest[] = readJsonArray(this.reviewRequestsPath)
      .map((entry) => ({
        requestId: typeof entry.requestId === "string" ? entry.requestId : randomUUID(),
        familyId: typeof entry.familyId === "string" ? entry.familyId : "unknown-family",
        divisionId: toNullableString(entry.divisionId),
        scenarioId: toNullableString(entry.scenarioId),
        requestedClaimLevel: typeof entry.requestedClaimLevel === "string"
          ? entry.requestedClaimLevel as LeadershipClaimLevel
          : "designed",
        requestedSurfaces: toStringArray(entry.requestedSurfaces) as LeadershipClaimSurface[],
        requestedBy: typeof entry.requestedBy === "string" ? entry.requestedBy : "unknown-requester",
        rationale: typeof entry.rationale === "string" ? entry.rationale : "",
        requestedAt: normalizeIsoOrNull(entry.requestedAt) ?? new Date(0).toISOString(),
        status: entry.status === "approved" || entry.status === "rejected" ? entry.status : "pending",
      }));
    return reviewRequests.sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  }

  public submitReviewRequest(input: {
    readonly familyId: string;
    readonly divisionId?: string | null;
    readonly scenarioId?: string | null;
    readonly requestedClaimLevel: LeadershipClaimLevel;
    readonly requestedSurfaces: readonly LeadershipClaimSurface[];
    readonly requestedBy: string;
    readonly rationale: string;
    readonly requestedAt?: string;
  }): LeadershipClaimReviewRequest {
    mkdirSync(this.governanceDataRoot, { recursive: true });
    const current = this.listReviewRequests();
    const created: LeadershipClaimReviewRequest = {
      requestId: randomUUID(),
      familyId: input.familyId.trim(),
      divisionId: input.divisionId?.trim() || null,
      scenarioId: input.scenarioId?.trim() || null,
      requestedClaimLevel: input.requestedClaimLevel,
      requestedSurfaces: [...input.requestedSurfaces],
      requestedBy: input.requestedBy.trim(),
      rationale: input.rationale.trim(),
      requestedAt: normalizeIsoOrNull(input.requestedAt) ?? new Date().toISOString(),
      status: "pending",
    };
    writeFileSync(this.reviewRequestsPath, JSON.stringify([created, ...current], null, 2), "utf8");
    return created;
  }

  public buildConsoleSnapshot(now: Date = new Date()): LeadershipClaimsConsoleSnapshot {
    const families = this.listFamilyReadiness();
    const claims = this.listClaims(now);
    const allowlist = this.listAllowlist(now);
    const reviewRequests = this.listReviewRequests();
    const noGoActions = this.listNoGoActions();
    const scanReport = this.readScanReport();
    return {
      generatedAt: now.toISOString(),
      families,
      claims,
      allowlist,
      scannerHits: scanReport.hits,
      scannerGeneratedAt: scanReport.generatedAt,
      reviewRequests,
      noGoActions,
      summary: {
        familyCount: families.length,
        approvedClaimCount: claims.filter((claim) => claim.effectiveStatus === "approved").length,
        expiringClaimCount: claims.filter((claim) => {
          if (claim.expiresAt == null || claim.effectiveStatus !== "approved") {
            return false;
          }
          const deltaMs = Date.parse(claim.expiresAt) - now.getTime();
          return deltaMs >= 0 && deltaMs <= 1000 * 60 * 60 * 24 * 30;
        }).length,
        pendingReviewRequestCount: reviewRequests.filter((request) => request.status === "pending").length,
        blockedScannerHitCount: scanReport.hits.filter((hit) => hit.status === "blocked" || hit.status === "expired_allowlist").length,
        expiredAllowlistCount: allowlist.filter((entry) => entry.expired).length,
      },
    };
  }

  private mapNoGoAction(action: Record<string, unknown>, familyId: string | null): LeadershipNoGoAction {
    return {
      familyId,
      id: typeof action.id === "string" ? action.id : "unnamed-no-go-action",
      description: typeof action.description === "string" ? action.description : "",
      riskClass: typeof action.riskClass === "string" ? action.riskClass : "",
      scopes: toStringArray(action.scopes),
      enforcementSurfaces: toStringArray(action.enforcementSurfaces),
      blockModes: toStringArray(action.blockModes),
    };
  }

  private readScanReport(): LeadershipClaimScanReport {
    if (!existsSync(this.scanReportPath)) {
      return { generatedAt: null, hits: [] };
    }
    const parsed = JSON.parse(readFileSync(this.scanReportPath, "utf8")) as unknown;
    if (!isPlainObject(parsed)) {
      return { generatedAt: null, hits: [] };
    }
    return {
      generatedAt: normalizeIsoOrNull(parsed.generatedAt),
      hits: toObjectArray(parsed.hits).map((hit) => ({
        filePath: typeof hit.filePath === "string" ? hit.filePath : "",
        matchedText: typeof hit.matchedText === "string" ? hit.matchedText : "",
        lineNumber: typeof hit.lineNumber === "number" ? hit.lineNumber : 0,
        excerpt: typeof hit.excerpt === "string" ? hit.excerpt : "",
        surface: typeof hit.surface === "string" ? hit.surface as LeadershipClaimSurface : "docs",
        status:
          hit.status === "allowlisted" || hit.status === "expired_allowlist" || hit.status === "approved_claim"
            ? hit.status
            : "blocked",
        claimId: toNullableString(hit.claimId),
        reason: toNullableString(hit.reason),
      })),
    };
  }

  private readYamlObject(path: string): Record<string, unknown> {
    const raw = readFileSync(path, "utf8");
    const parsed = parseLimitedYaml(raw, path);
    return isPlainObject(parsed) ? parsed : {};
  }
}
