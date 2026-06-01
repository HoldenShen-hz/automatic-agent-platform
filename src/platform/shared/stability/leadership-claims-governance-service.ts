import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  LeadershipClaimConfigRegistry,
} from "./leadership-claim-config-registry.js";
import type {
  FamilyLeadershipReadiness,
  LeadershipClaimAllowlistEntry,
  LeadershipClaimLevel,
  LeadershipClaimRecord,
  LeadershipClaimStatus,
  LeadershipClaimSurface,
} from "./leadership-claim-config-registry.js";
import {
  NoGoPolicyRegistry,
} from "../../five-plane-control-plane/iam/no-go-policy-registry.js";
import type { NoGoPolicyAction } from "../../five-plane-control-plane/iam/no-go-policy-registry.js";
import {
  isPlainObject,
  toObjectArray,
  toStringArray,
} from "../../../domains/governance/division-loader-support.js";

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
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly decisionReasonCode: string | null;
  readonly decisionComment: string | null;
}

export interface LeadershipClaimStatusOverride {
  readonly claimId: string;
  readonly status: "revoked";
  readonly reasonCode: string;
  readonly comment: string | null;
  readonly replacementRequired: boolean;
  readonly revokedBy: string;
  readonly revokedAt: string;
}

export interface LeadershipClaimRecordView extends LeadershipClaimRecord {
  readonly effectiveStatus: LeadershipClaimStatus;
  readonly effectiveStatusReasonCode: string | null;
  readonly revokedBy: string | null;
  readonly revokedAt: string | null;
  readonly replacementRequired: boolean;
}

export interface LeadershipClaimsConsoleSnapshot {
  readonly generatedAt: string;
  readonly families: readonly FamilyLeadershipReadiness[];
  readonly claims: readonly LeadershipClaimRecordView[];
  readonly allowlist: readonly LeadershipClaimAllowlistEntry[];
  readonly scannerHits: readonly LeadershipClaimScannerHit[];
  readonly scannerGeneratedAt: string | null;
  readonly reviewRequests: readonly LeadershipClaimReviewRequest[];
  readonly noGoActions: readonly NoGoPolicyAction[];
  readonly summary: {
    readonly familyCount: number;
    readonly approvedClaimCount: number;
    readonly expiringClaimCount: number;
    readonly pendingReviewRequestCount: number;
    readonly blockedScannerHitCount: number;
    readonly expiredAllowlistCount: number;
    readonly revokedClaimCount: number;
    readonly expiredClaimCount: number;
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

interface ReviewDecisionInput {
  readonly requestId: string;
  readonly reviewedBy: string;
  readonly reviewedAt?: string;
  readonly reasonCode: string;
  readonly comment?: string | null;
}

interface ClaimRevokeInput {
  readonly claimId: string;
  readonly reasonCode: string;
  readonly comment?: string | null;
  readonly replacementRequired: boolean;
  readonly revokedBy: string;
  readonly revokedAt?: string;
}

function readJsonArray(path: string): Record<string, unknown>[] {
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return toObjectArray(parsed);
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
  private readonly governanceDataRoot: string;
  private readonly reviewRequestsPath: string;
  private readonly claimStatusOverridesPath: string;
  private readonly scanReportPath: string;
  private readonly configRegistry: LeadershipClaimConfigRegistry;
  private readonly noGoPolicyRegistry: NoGoPolicyRegistry;

  public constructor(options: LeadershipClaimsGovernanceServiceOptions = {}) {
    const platformRoot = resolvePlatformRoot(options.platformRoot);
    const resolvedDataRoot = resolveDataRoot(platformRoot, options.dataRoot);
    this.configRegistry = new LeadershipClaimConfigRegistry({
      platformRoot,
      ...(options.configRoot != null ? { configRoot: options.configRoot } : {}),
    });
    this.noGoPolicyRegistry = new NoGoPolicyRegistry({
      platformRoot,
      ...(options.policyRoot != null ? { policyRoot: options.policyRoot } : {}),
    });
    this.governanceDataRoot = join(resolvedDataRoot, "governance");
    this.reviewRequestsPath = join(this.governanceDataRoot, "leadership-claim-review-requests.json");
    this.claimStatusOverridesPath = join(this.governanceDataRoot, "leadership-claim-status-overrides.json");
    this.scanReportPath = join(this.governanceDataRoot, "leadership-claim-scan-report.json");
  }

  public listFamilyReadiness(): FamilyLeadershipReadiness[] {
    return this.configRegistry.listFamilyReadiness();
  }

  public listClaims(now: Date = new Date()): LeadershipClaimRecordView[] {
    const overridesByClaimId = new Map(this.listStatusOverrides().map((override) => [override.claimId, override]));
    return this.configRegistry.listClaims().map((claim) => {
      const override = overridesByClaimId.get(claim.claimId) ?? null;
      const expired = claim.status === "approved" && isExpired(claim.expiresAt, now);
      const effectiveStatus = override?.status ?? (expired ? "expired" : claim.status);
      const effectiveStatusReasonCode =
        override?.reasonCode
          ?? (expired ? "claim.expired" : null);
      return {
        ...claim,
        effectiveStatus,
        effectiveStatusReasonCode,
        revokedBy: override?.revokedBy ?? null,
        revokedAt: override?.revokedAt ?? null,
        replacementRequired: override?.replacementRequired ?? false,
      };
    });
  }

  public listAllowlist(now: Date = new Date()): LeadershipClaimAllowlistEntry[] {
    return this.configRegistry.listAllowlist(now);
  }

  public listNoGoActions(): NoGoPolicyAction[] {
    return this.noGoPolicyRegistry.listActions();
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
        reviewedBy: toNullableString(entry.reviewedBy),
        reviewedAt: normalizeIsoOrNull(entry.reviewedAt),
        decisionReasonCode: toNullableString(entry.decisionReasonCode),
        decisionComment: toNullableString(entry.decisionComment),
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
      reviewedBy: null,
      reviewedAt: null,
      decisionReasonCode: null,
      decisionComment: null,
    };
    this.writeReviewRequests([created, ...current]);
    return created;
  }

  public approveReviewRequest(input: ReviewDecisionInput): LeadershipClaimReviewRequest {
    return this.applyReviewDecision("approved", input);
  }

  public rejectReviewRequest(input: ReviewDecisionInput): LeadershipClaimReviewRequest {
    return this.applyReviewDecision("rejected", input);
  }

  public listStatusOverrides(): LeadershipClaimStatusOverride[] {
    return readJsonArray(this.claimStatusOverridesPath).flatMap((entry) => {
      if (entry.status !== "revoked") {
        return [];
      }
      return [{
        claimId: typeof entry.claimId === "string" ? entry.claimId : "unknown-claim",
        status: "revoked" as const,
        reasonCode: typeof entry.reasonCode === "string" ? entry.reasonCode : "claim.revoked",
        comment: toNullableString(entry.comment),
        replacementRequired: entry.replacementRequired === true,
        revokedBy: typeof entry.revokedBy === "string" ? entry.revokedBy : "unknown-operator",
        revokedAt: normalizeIsoOrNull(entry.revokedAt) ?? new Date(0).toISOString(),
      }];
    });
  }

  public revokeClaim(input: ClaimRevokeInput): LeadershipClaimStatusOverride {
    const claim = this.configRegistry.listClaims().find((entry) => entry.claimId === input.claimId);
    if (claim == null) {
      throw new Error(`leadership_claim.claim_not_found:${input.claimId}`);
    }
    mkdirSync(this.governanceDataRoot, { recursive: true });
    const overrides = this.listStatusOverrides().filter((entry) => entry.claimId !== input.claimId);
    const revoked: LeadershipClaimStatusOverride = {
      claimId: input.claimId,
      status: "revoked",
      reasonCode: input.reasonCode.trim(),
      comment: input.comment?.trim() || null,
      replacementRequired: input.replacementRequired,
      revokedBy: input.revokedBy.trim(),
      revokedAt: normalizeIsoOrNull(input.revokedAt) ?? new Date().toISOString(),
    };
    this.writeStatusOverrides([revoked, ...overrides]);
    return revoked;
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
        revokedClaimCount: claims.filter((claim) => claim.effectiveStatus === "revoked").length,
        expiredClaimCount: claims.filter((claim) => claim.effectiveStatus === "expired").length,
      },
    };
  }

  private applyReviewDecision(
    nextStatus: "approved" | "rejected",
    input: ReviewDecisionInput,
  ): LeadershipClaimReviewRequest {
    const reviewRequests = this.listReviewRequests();
    const match = reviewRequests.find((request) => request.requestId === input.requestId);
    if (match == null) {
      throw new Error(`leadership_claim.review_request_not_found:${input.requestId}`);
    }
    if (match.status !== "pending") {
      throw new Error(`leadership_claim.review_request_not_pending:${input.requestId}`);
    }
    const updated: LeadershipClaimReviewRequest = {
      ...match,
      status: nextStatus,
      reviewedBy: input.reviewedBy.trim(),
      reviewedAt: normalizeIsoOrNull(input.reviewedAt) ?? new Date().toISOString(),
      decisionReasonCode: input.reasonCode.trim(),
      decisionComment: input.comment?.trim() || null,
    };
    this.writeReviewRequests(reviewRequests.map((request) => request.requestId === updated.requestId ? updated : request));
    return updated;
  }

  private writeReviewRequests(reviewRequests: readonly LeadershipClaimReviewRequest[]): void {
    writeFileSync(this.reviewRequestsPath, JSON.stringify(reviewRequests, null, 2), "utf8");
  }

  private writeStatusOverrides(overrides: readonly LeadershipClaimStatusOverride[]): void {
    writeFileSync(this.claimStatusOverridesPath, JSON.stringify(overrides, null, 2), "utf8");
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
}

export type {
  FamilyLeadershipReadiness,
  LeadershipClaimAllowlistEntry,
  LeadershipClaimLevel,
  LeadershipClaimRecord,
  LeadershipClaimStatus,
  LeadershipClaimSurface,
};
