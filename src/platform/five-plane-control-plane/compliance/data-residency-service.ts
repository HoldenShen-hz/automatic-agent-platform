/**
 * @fileoverview Data Residency Service - Data residency enforcement and jurisdiction mapping
 *
 * ## Overview
 *
 * Enforces data residency requirements based on jurisdiction regulations.
 * Maps regions to jurisdictions and validates data placement compliance.
 * Supports GDPR (EU), CCPA (US), and other regional data protection requirements.
 *
 * ## Key Concepts
 *
 * - **Jurisdiction**: Legal region with specific data protection requirements
 * - **Region**: Physical or logical data center location
 * - **Data residency rule**: Retention and encryption requirements per jurisdiction
 * - **Residency violation**: Data found in non-compliant region
 *
 * ## Supported Jurisdictions
 *
 * - EU (European Union) - GDPR compliant
 * - US (United States) - CCPA compliant
 * - APAC (Asia-Pacific) - Local data protection laws
 * - OTHER - Default/residual jurisdiction
 *
 * ## Region Mapping
 *
 * - eu-west-1, eu-north-1 -> EU
 * - us-east-1, us-west-2 -> US
 * - ap-southeast-1, ap-northeast-1 -> APAC
 * - Other regions -> OTHER
 *
 * @see GDPR Article 44-49: Data transfers
 * @see docs_zh/architecture/00-platform-architecture.md
 *
 * @packageDocumentation
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError, PolicyDeniedError } from "../../contracts/errors.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ComplianceStore } from "./types.js";

/**
 * Jurisdiction enum - legal regions with specific data protection requirements
 */
export type Jurisdiction = "EU" | "US" | "APAC" | "OTHER";

/**
 * Data region enum - platform deployment regions
 */
export type DataRegion =
  | "eu-west-1"
  | "eu-north-1"
  | "us-east-1"
  | "us-west-2"
  | "ap-southeast-1"
  | "ap-northeast-1"
  | "other";

/**
 * Data category for classification
 */
export type DataCategory = "personal" | "financial" | "health" | "biometric" | "children" | "government" | "business";

/**
 * Data residency rule defining requirements for a jurisdiction
 */
export interface DataResidencyRule {
  /** Jurisdiction identifier */
  jurisdiction: Jurisdiction;
  /** Required retention period in days */
  retentionDays: number;
  /** Required encryption standard */
  encryptionStandard: "AES-256" | "AES-128" | "legacy";
  /** Whether cross-border data transfers are allowed */
  crossBorderTransfersAllowed: boolean;
  /** List of allowed target jurisdictions for transfers */
  allowedTransferJurisdictions: readonly Jurisdiction[];
  /** Whether data must remain within the jurisdiction */
  dataLocalizationRequired: boolean;
  /** Metadata JSON for additional requirements */
  metadataJson: string | null;
}

/**
 * Data placement record - where tenant data is actually stored
 */
export interface DataPlacement {
  /** Unique identifier */
  placementId: string;
  /** Tenant identifier */
  tenantId: string;
  /** Data category */
  category: DataCategory;
  /** Current region where data is stored */
  currentRegion: DataRegion;
  /** Mapped jurisdiction */
  currentJurisdiction: Jurisdiction;
  /** Whether this placement is compliant */
  isCompliant: boolean;
  /** ISO timestamp when placement was recorded */
  recordedAt: string;
  /** Metadata JSON */
  metadataJson: string | null;
}

/**
 * Residency violation record
 */
export interface ResidencyViolation {
  /** Unique identifier */
  violationId: string;
  /** Tenant identifier */
  tenantId: string;
  /** Data category with violation */
  category: DataCategory;
  /** Region where data was found */
  region: DataRegion;
  /** Jurisdiction of the region */
  jurisdiction: Jurisdiction;
  /** Rule that was violated */
  violatedRuleId: string;
  /** Description of the violation */
  description: string;
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";
  /** ISO timestamp when violation was detected */
  detectedAt: string;
  /** ISO timestamp when violation was resolved (null if unresolved) */
  resolvedAt: string | null;
  /** Resolution notes */
  resolutionNotes: string | null;
}

/**
 * Input for checking data residency
 */
export interface CheckResidencyInput {
  tenantId: string;
  category: DataCategory;
  currentRegion: DataRegion;
}

/**
 * Input for validating data placement
 */
export interface ValidatePlacementInput {
  tenantId: string;
  targetRegion: DataRegion;
  category: DataCategory;
}

/**
 * Result of a residency check
 */
export interface ResidencyCheckResult {
  isCompliant: boolean;
  currentRegion: DataRegion;
  currentJurisdiction: Jurisdiction;
  targetJurisdiction: Jurisdiction;
  rule: DataResidencyRule | null;
  violations: string[];
}

/**
 * Store type with compliance submodule
 */
type StoreWithCompliance = AuthoritativeTaskStore & {
  compliance: ComplianceStore;
};

/**
 * Default residency rules per jurisdiction
 */
const DEFAULT_RESIDENCY_RULES: Record<Jurisdiction, DataResidencyRule> = {
  EU: {
    jurisdiction: "EU",
    retentionDays: 365,
    encryptionStandard: "AES-256",
    crossBorderTransfersAllowed: false,
    allowedTransferJurisdictions: [],
    dataLocalizationRequired: true,
    metadataJson: JSON.stringify({ regulation: "GDPR", description: "European Union data protection" }),
  },
  US: {
    jurisdiction: "US",
    retentionDays: 2555, // ~7 years
    encryptionStandard: "AES-256",
    crossBorderTransfersAllowed: true,
    allowedTransferJurisdictions: ["US", "OTHER"],
    dataLocalizationRequired: false,
    metadataJson: JSON.stringify({ regulation: "CCPA", description: "California Consumer Privacy Act" }),
  },
  APAC: {
    jurisdiction: "APAC",
    retentionDays: 730,
    encryptionStandard: "AES-256",
    crossBorderTransfersAllowed: true,
    allowedTransferJurisdictions: ["APAC", "OTHER"],
    dataLocalizationRequired: false,
    metadataJson: JSON.stringify({ regulation: "PDPA", description: "Asia-Pacific data protection" }),
  },
  OTHER: {
    jurisdiction: "OTHER",
    retentionDays: 180,
    encryptionStandard: "AES-128",
    crossBorderTransfersAllowed: true,
    allowedTransferJurisdictions: ["OTHER"],
    dataLocalizationRequired: false,
    metadataJson: JSON.stringify({ regulation: "default", description: "Default data protection" }),
  },
};

/**
 * Region to jurisdiction mapping
 */
const REGION_JURISDICTION_MAP: Record<DataRegion, Jurisdiction> = {
  "eu-west-1": "EU",
  "eu-north-1": "EU",
  "us-east-1": "US",
  "us-west-2": "US",
  "ap-southeast-1": "APAC",
  "ap-northeast-1": "APAC",
  other: "OTHER",
};

/**
 * Validates a region value
 */
function isValidRegion(region: string): region is DataRegion {
  return region in REGION_JURISDICTION_MAP;
}

/**
 * Service for data residency enforcement and jurisdiction mapping.
 *
 * Validates that tenant data is stored in regions compliant with
 * applicable data protection regulations.
 *
 * ## Usage
 *
 * ```typescript
 * const residencyService = new DataResidencyService(db, store);
 *
 * // Check if a data placement is compliant
 * const result = residencyService.checkResidency({
 *   tenantId: "tenant-123",
 *   category: "personal",
 *   currentRegion: "eu-west-1",
 * });
 *
 * // Validate a proposed data placement
 * const validation = residencyService.validateDataPlacement({
 *   tenantId: "tenant-123",
 *   targetRegion: "us-east-1",
 *   category: "personal",
 * });
 *
 * // Get jurisdiction for a region
 * const jurisdiction = residencyService.getJurisdictionForRegion("eu-west-1");
 * ```
 */
export class DataResidencyService {
  private readonly store: StoreWithCompliance;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore & { compliance: ComplianceStore },
  ) {
    this.store = store as StoreWithCompliance;
  }

  /**
   * Gets the jurisdiction for a given region.
   *
   * @param region - The data region
   * @returns The jurisdiction
   */
  public getJurisdictionForRegion(region: string): Jurisdiction {
    if (!isValidRegion(region)) {
      return "OTHER";
    }
    return REGION_JURISDICTION_MAP[region];
  }

  /**
   * Gets the residency rule for a jurisdiction.
   *
   * @param jurisdiction - The jurisdiction
   * @returns The residency rule
   */
  public getResidencyRule(jurisdiction: Jurisdiction): DataResidencyRule {
    return DEFAULT_RESIDENCY_RULES[jurisdiction];
  }

  /**
   * Checks if data placement is compliant with residency requirements.
   *
   * @param input - The placement to check
   * @returns Compliance check result
   */
  public checkResidency(input: CheckResidencyInput): ResidencyCheckResult {
    const currentJurisdiction = this.getJurisdictionForRegion(input.currentRegion);
    const rule = this.getResidencyRule(currentJurisdiction);

    const violations: string[] = [];

    // Check data localization requirement
    if (rule.dataLocalizationRequired && currentJurisdiction !== "EU" && input.category === "personal") {
      // EU requires personal data to stay in EU
      violations.push(
        `Data localization required for ${input.category} data in EU jurisdiction, but data is in ${input.currentRegion}`,
      );
    }

    // Check cross-border transfer restrictions
    if (!rule.crossBorderTransfersAllowed && currentJurisdiction !== "OTHER") {
      violations.push(`Cross-border transfers not allowed for ${currentJurisdiction} jurisdiction`);
    }

    const isCompliant = violations.length === 0;

    // Record the placement
    this.db.transaction(() => {
      const placement: DataPlacement = {
        placementId: newId("placement"),
        tenantId: input.tenantId,
        category: input.category,
        currentRegion: input.currentRegion,
        currentJurisdiction,
        isCompliant,
        recordedAt: nowIso(),
        metadataJson: null,
      };

      this.store.compliance.insertDataPlacement(placement);

      // If not compliant, create a violation record
      if (!isCompliant) {
        const violation: ResidencyViolation = {
          violationId: newId("violation"),
          tenantId: input.tenantId,
          category: input.category,
          region: input.currentRegion,
          jurisdiction: currentJurisdiction,
          violatedRuleId: `rule_${currentJurisdiction.toLowerCase()}`,
          description: violations.join("; "),
          severity: currentJurisdiction === "EU" ? "high" : "medium",
          detectedAt: nowIso(),
          resolvedAt: null,
          resolutionNotes: null,
        };

        this.store.compliance.insertResidencyViolation(violation);
      }
    });

    return {
      isCompliant,
      currentRegion: input.currentRegion,
      currentJurisdiction,
      targetJurisdiction: currentJurisdiction,
      rule,
      violations,
    };
  }

  /**
   * Validates a proposed data placement before moving data.
   *
   * @param input - The proposed placement
   * @returns Whether the placement would be compliant
   * @throws PolicyDeniedError if placement would violate residency rules
   */
  public validateDataPlacement(input: ValidatePlacementInput): void {
    const targetJurisdiction = this.getJurisdictionForRegion(input.targetRegion);
    const rule = this.getResidencyRule(targetJurisdiction);

    // Check if target jurisdiction allows the data category
    if (rule.dataLocalizationRequired && input.category === "personal" && targetJurisdiction !== "EU") {
      throw new PolicyDeniedError(
        `residency.placement_not_allowed:${input.targetRegion}`,
        `Cannot place personal data in ${input.targetRegion} as EU data localization is required`,
        {
          details: { region: input.targetRegion, category: input.category, jurisdiction: targetJurisdiction },
        },
      );
    }

    // Check cross-border transfer restrictions
    if (!rule.crossBorderTransfersAllowed && targetJurisdiction !== "OTHER") {
      throw new PolicyDeniedError(
        `residency.cross_border_not_allowed:${input.targetRegion}`,
        `Cross-border transfers to ${targetJurisdiction} are not allowed`,
        {
          details: { region: input.targetRegion, jurisdiction: targetJurisdiction },
        },
      );
    }
  }

  /**
   * Lists all residency violations for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @param includeResolved - Whether to include resolved violations
   * @returns Array of violations
   */
  public listResidencyViolations(tenantId: string, includeResolved = false): ResidencyViolation[] {
    const violations = this.store.compliance.listResidencyViolationsByTenant(tenantId);

    if (includeResolved) {
      return violations.sort(
        (a: ResidencyViolation, b: ResidencyViolation) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt),
      );
    }

    return violations
      .filter((v: ResidencyViolation) => v.resolvedAt === null)
      .sort((a: ResidencyViolation, b: ResidencyViolation) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
  }

  /**
   * Resolves a residency violation.
   *
   * @param violationId - The violation ID
   * @param resolutionNotes - Notes on how the violation was resolved
   * @returns The resolved violation
   */
  public resolveViolation(violationId: string, resolutionNotes: string): ResidencyViolation {
    return this.db.transaction(() => {
      const violations = this.store.compliance.listAllResidencyViolations();
      const violation = violations.find((v: ResidencyViolation) => v.violationId === violationId);

      if (!violation) {
        throw new ValidationError(
          `residency.violation_not_found:${violationId}`,
          `Residency violation not found: ${violationId}`,
          {
            details: { violationId },
          },
        );
      }

      const resolved: ResidencyViolation = {
        ...violation,
        resolvedAt: nowIso(),
        resolutionNotes,
      };

      this.store.compliance.updateResidencyViolation(resolved);

      return resolved;
    });
  }

  /**
   * Gets data placements for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Array of data placements
   */
  public listDataPlacements(tenantId: string): DataPlacement[] {
    return this.store.compliance.listDataPlacementsByTenant(tenantId);
  }

  /**
   * Gets the primary region for a tenant based on their data placements.
   *
   * @param tenantId - The tenant identifier
   * @returns The primary region or null if no placements recorded
   */
  public getTenantPrimaryRegion(tenantId: string): DataRegion | null {
    const placements = this.store.compliance.listDataPlacementsByTenant(tenantId);
    if (placements.length === 0) {
      return null;
    }

    // Find the most recent placement
    const sorted = [...placements].sort((a: DataPlacement, b: DataPlacement) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    return sorted[0]?.currentRegion ?? null;
  }

  /**
   * Gets the effective jurisdiction for a tenant based on their data placements.
   *
   * @param tenantId - The tenant identifier
   * @returns The jurisdiction or null if no placements recorded
   */
  public getTenantEffectiveJurisdiction(tenantId: string): Jurisdiction | null {
    const placements = this.store.compliance.listDataPlacementsByTenant(tenantId);
    if (placements.length === 0) {
      return null;
    }

    // Find the most recent placement
    const sorted = [...placements].sort((a: DataPlacement, b: DataPlacement) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    return sorted[0]?.currentJurisdiction ?? null;
  }

  /**
   * Checks if a tenant is fully compliant across all data placements.
   *
   * @param tenantId - The tenant identifier
   * @returns True if all placements are compliant
   */
  public isTenantCompliant(tenantId: string): boolean {
    const violations = this.listResidencyViolations(tenantId, false);
    return violations.length === 0;
  }

  /**
   * Gets a summary of compliance status for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Compliance summary
   */
  public getTenantComplianceSummary(
    tenantId: string,
  ): {
    isCompliant: boolean;
    totalPlacements: number;
    compliantPlacements: number;
    nonCompliantPlacements: number;
    openViolations: number;
    resolvedViolations: number;
    effectiveJurisdiction: Jurisdiction | null;
    primaryRegion: DataRegion | null;
  } {
    const placements = this.store.compliance.listDataPlacementsByTenant(tenantId);
    const violations = this.store.compliance.listResidencyViolationsByTenant(tenantId);

    const compliantPlacements = placements.filter((p: DataPlacement) => p.isCompliant).length;
    const openViolations = violations.filter((v: ResidencyViolation) => v.resolvedAt === null).length;
    const resolvedViolations = violations.filter((v: ResidencyViolation) => v.resolvedAt !== null).length;

    return {
      isCompliant: openViolations === 0,
      totalPlacements: placements.length,
      compliantPlacements,
      nonCompliantPlacements: placements.length - compliantPlacements,
      openViolations,
      resolvedViolations,
      effectiveJurisdiction: this.getTenantEffectiveJurisdiction(tenantId),
      primaryRegion: this.getTenantPrimaryRegion(tenantId),
    };
  }
}
