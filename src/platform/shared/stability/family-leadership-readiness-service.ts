import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { NoGoPolicyRegistry } from "../../five-plane-control-plane/iam/no-go-policy-registry.js";
import {
  LeadershipClaimConfigRegistry,
  type FamilyLeadershipReadiness,
  type FamilyLeadershipScoreWeights,
} from "./leadership-claim-config-registry.js";
import {
  isPlainObject,
  parseLimitedYaml,
  toObjectArray,
  toStringArray,
} from "../../../domains/governance/division-loader-support.js";

export interface FamilyLeadershipScoreCard {
  readonly capability: number;
  readonly safety: number;
  readonly evidence: number;
  readonly operation: number;
  readonly flywheel: number;
  readonly overall: number;
}

export interface FamilyReadinessTransition {
  readonly currentStatus: string;
  readonly nextStatus: string | null;
  readonly blockers: readonly string[];
}

export interface FamilyExpansionPlan {
  readonly familyId: string;
  readonly leadershipTypes: readonly string[];
  readonly pilotDivisions: readonly string[];
  readonly targetDivisions: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly blockedRisks: readonly string[];
  readonly targetRelease: string | null;
}

export interface FamilyLeadershipReadinessAssessment extends FamilyLeadershipReadiness {
  readonly recommendedLeadershipTypes: readonly string[];
  readonly approvedActiveClaimCount: number;
  readonly scoreCard: FamilyLeadershipScoreCard;
  readonly transition: FamilyReadinessTransition;
  readonly expansionPlan: FamilyExpansionPlan | null;
}

export interface FamilyLeadershipReadinessServiceOptions {
  readonly platformRoot?: string;
  readonly configRoot?: string;
}

interface DivisionInventoryRecordLike {
  readonly divisionId: string;
  readonly status: string;
}

const READINESS_ORDER = [
  "governance_ready",
  "pilot_ready",
  "local_leadership_ready",
  "industry_ready",
] as const;

const DEFAULT_FAMILY_WEIGHTS: FamilyLeadershipScoreWeights = {
  capability: 30,
  safety: 25,
  evidence: 20,
  operation: 15,
  flywheel: 10,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolvePlatformRoot(platformRoot?: string): string {
  return platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

function normalizeIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function isApprovedActiveClaim(entry: Record<string, unknown>, now: Date): boolean {
  if (entry.status !== "approved") {
    return false;
  }
  const expiresAt = normalizeIsoOrNull(entry.expiresAt);
  return expiresAt == null || Date.parse(expiresAt) >= now.getTime();
}

function nextReadinessStatus(status: string): string | null {
  const index = READINESS_ORDER.indexOf(status as (typeof READINESS_ORDER)[number]);
  if (index < 0 || index === READINESS_ORDER.length - 1) {
    return null;
  }
  return READINESS_ORDER[index + 1] ?? null;
}

function deriveReadinessStatus(score: number, blockers: readonly string[]): string {
  if (blockers.length > 0) {
    return "governance_ready";
  }
  if (score >= 85) {
    return "industry_ready";
  }
  if (score >= 70) {
    return "local_leadership_ready";
  }
  if (score >= 50) {
    return "pilot_ready";
  }
  return "governance_ready";
}

function toDivisionInventoryRecords(value: unknown): DivisionInventoryRecordLike[] {
  return toObjectArray(value).flatMap((entry) => {
    if (typeof entry.divisionId !== "string" || typeof entry.status !== "string") {
      return [];
    }
    return [{ divisionId: entry.divisionId, status: entry.status }];
  });
}

function readYamlObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  const parsed = parseLimitedYaml(readFileSync(path, "utf8"), path);
  return isPlainObject(parsed) ? parsed : {};
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return isPlainObject(parsed) ? parsed : {};
}

export class FamilyLeadershipReadinessService {
  private readonly platformRoot: string;
  private readonly configRoot: string;
  private readonly registry: LeadershipClaimConfigRegistry;
  private readonly noGoPolicyRegistry: NoGoPolicyRegistry;

  public constructor(options: FamilyLeadershipReadinessServiceOptions = {}) {
    this.platformRoot = resolvePlatformRoot(options.platformRoot);
    this.configRoot = options.configRoot ?? join(this.platformRoot, "config", "division-coverage");
    this.registry = new LeadershipClaimConfigRegistry({
      platformRoot: this.platformRoot,
      configRoot: this.configRoot,
    });
    this.noGoPolicyRegistry = new NoGoPolicyRegistry({ platformRoot: this.platformRoot });
  }

  public listAssessments(now: Date = new Date()): FamilyLeadershipReadinessAssessment[] {
    const claimsConfig = readYamlObject(join(this.configRoot, "claims", "records.yaml"));
    const approvedClaimsByFamily = new Map<string, number>();
    for (const claim of toObjectArray(claimsConfig.claims)) {
      const familyId = typeof claim.familyId === "string" ? claim.familyId : null;
      if (familyId == null || !isApprovedActiveClaim(claim, now)) {
        continue;
      }
      approvedClaimsByFamily.set(familyId, (approvedClaimsByFamily.get(familyId) ?? 0) + 1);
    }

    const expansionConfig = readYamlObject(join(this.configRoot, "family-expansion.yaml"));
    const expansionPlanByFamily = new Map<string, FamilyExpansionPlan>();
    for (const entry of toObjectArray(expansionConfig.families)) {
      const familyId = typeof entry.familyId === "string" ? entry.familyId : null;
      if (familyId == null) {
        continue;
      }
      expansionPlanByFamily.set(familyId, {
        familyId,
        leadershipTypes: toStringArray(entry.leadershipTypes),
        pilotDivisions: toStringArray(entry.pilotDivisions),
        targetDivisions: toStringArray(entry.targetDivisions),
        requiredEvidence: toStringArray(entry.requiredEvidence),
        blockedRisks: toStringArray(entry.blockedRisks),
        targetRelease: typeof entry.targetRelease === "string" ? entry.targetRelease : null,
      });
    }

    const inventorySnapshot = readJsonObject(join(this.configRoot, "inventory", "division-inventory.generated.json"));
    const inventoryRecords = toDivisionInventoryRecords(inventorySnapshot.records);
    const inventoryByDivision = new Map(inventoryRecords.map((record) => [record.divisionId, record]));

    return this.registry.listFamilyReadiness().map((family) => {
      const expansionPlan = expansionPlanByFamily.get(family.familyId) ?? null;
      const approvedActiveClaimCount = approvedClaimsByFamily.get(family.familyId) ?? 0;
      const noGoActionCount = this.noGoPolicyRegistry.findMatchingActions({ familyId: family.familyId }).length;
      const validatedDivisionCount = family.canonicalDivisions
        .filter((divisionId) => inventoryByDivision.has(divisionId))
        .length;
      const readyDivisionCount = family.canonicalDivisions
        .map((divisionId) => inventoryByDivision.get(divisionId))
        .filter((record) => record?.status === "production_ready" || record?.status === "pilot_ready")
        .length;
      const capability = clampScore(
        (family.benchmarks.length > 0 ? 35 : 0)
        + (family.internalMappings.length > 0 ? 25 : 0)
        + (approvedActiveClaimCount > 0 ? 25 : 0)
        + (expansionPlan?.pilotDivisions.length ? 15 : 0),
      );
      const safety = clampScore(
        (noGoActionCount > 0 ? 50 : 0)
        + (family.familyId === "regulated" ? 30 : 15)
        + (family.leadershipThresholds.length > 0 ? 20 : 0),
      );
      const evidence = clampScore(
        (family.mvpThresholds.length > 0 ? 30 : 0)
        + (family.leadershipThresholds.length > 0 ? 30 : 0)
        + (approvedActiveClaimCount > 0 ? 20 : 0)
        + (family.benchmarkRefs.length > 0 ? 20 : 0),
      );
      const operation = clampScore(
        (family.owner.trim().length > 0 ? 30 : 0)
        + (family.canonicalDivisions.length > 0 ? 20 : 0)
        + (validatedDivisionCount === family.canonicalDivisions.length ? 25 : validatedDivisionCount > 0 ? 10 : 0)
        + (readyDivisionCount > 0 ? 25 : 0),
      );
      const flywheel = clampScore(
        (family.internalMappings.length > 0 ? 30 : 0)
        + (family.benchmarkRefs.length > 0 ? 20 : 0)
        + (expansionPlan?.requiredEvidence.length ? 25 : 0)
        + (approvedActiveClaimCount > 0 ? 25 : 0),
      );
      const weights = family.familyPolicy.scoreWeights ?? DEFAULT_FAMILY_WEIGHTS;
      const overall = clampScore(
        (capability * weights.capability) / 100
        + (safety * weights.safety) / 100
        + (evidence * weights.evidence) / 100
        + (operation * weights.operation) / 100
        + (flywheel * weights.flywheel) / 100,
      );

      const blockers: string[] = [];
      if (approvedActiveClaimCount === 0 && family.targetClaimLevel !== "designed") {
        blockers.push("missing_active_approved_claim");
      }
      if (expansionPlan == null) {
        blockers.push("missing_family_expansion_plan");
      }
      if (validatedDivisionCount !== family.canonicalDivisions.length) {
        blockers.push("division_inventory_gap");
      }
      if (noGoActionCount === 0) {
        blockers.push("missing_family_no_go_actions");
      }
      const derivedReadinessStatus = deriveReadinessStatus(overall, blockers);
      if (family.readinessStatus !== derivedReadinessStatus) {
        blockers.push(`readiness_status_mismatch:${family.readinessStatus}->${derivedReadinessStatus}`);
      }

      return {
        ...family,
        recommendedLeadershipTypes: expansionPlan?.leadershipTypes ?? [],
        approvedActiveClaimCount,
        scoreCard: {
          capability,
          safety,
          evidence,
          operation,
          flywheel,
          overall,
        },
        transition: {
          currentStatus: family.readinessStatus,
          nextStatus: nextReadinessStatus(family.readinessStatus),
          blockers,
        },
        expansionPlan,
      };
    });
  }
}
