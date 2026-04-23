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
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ComplianceStore } from "./types.js";
/**
 * Jurisdiction enum - legal regions with specific data protection requirements
 */
export type Jurisdiction = "EU" | "US" | "APAC" | "OTHER";
/**
 * Data region enum - platform deployment regions
 */
export type DataRegion = "eu-west-1" | "eu-north-1" | "us-east-1" | "us-west-2" | "ap-southeast-1" | "ap-northeast-1" | "other";
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
export declare class DataResidencyService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore & {
        compliance: ComplianceStore;
    });
    /**
     * Gets the jurisdiction for a given region.
     *
     * @param region - The data region
     * @returns The jurisdiction
     */
    getJurisdictionForRegion(region: string): Jurisdiction;
    /**
     * Gets the residency rule for a jurisdiction.
     *
     * @param jurisdiction - The jurisdiction
     * @returns The residency rule
     */
    getResidencyRule(jurisdiction: Jurisdiction): DataResidencyRule;
    /**
     * Checks if data placement is compliant with residency requirements.
     *
     * @param input - The placement to check
     * @returns Compliance check result
     */
    checkResidency(input: CheckResidencyInput): ResidencyCheckResult;
    /**
     * Validates a proposed data placement before moving data.
     *
     * @param input - The proposed placement
     * @returns Whether the placement would be compliant
     * @throws PolicyDeniedError if placement would violate residency rules
     */
    validateDataPlacement(input: ValidatePlacementInput): void;
    /**
     * Lists all residency violations for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @param includeResolved - Whether to include resolved violations
     * @returns Array of violations
     */
    listResidencyViolations(tenantId: string, includeResolved?: boolean): ResidencyViolation[];
    /**
     * Resolves a residency violation.
     *
     * @param violationId - The violation ID
     * @param resolutionNotes - Notes on how the violation was resolved
     * @returns The resolved violation
     */
    resolveViolation(violationId: string, resolutionNotes: string): ResidencyViolation;
    /**
     * Gets data placements for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Array of data placements
     */
    listDataPlacements(tenantId: string): DataPlacement[];
    /**
     * Gets the primary region for a tenant based on their data placements.
     *
     * @param tenantId - The tenant identifier
     * @returns The primary region or null if no placements recorded
     */
    getTenantPrimaryRegion(tenantId: string): DataRegion | null;
    /**
     * Gets the effective jurisdiction for a tenant based on their data placements.
     *
     * @param tenantId - The tenant identifier
     * @returns The jurisdiction or null if no placements recorded
     */
    getTenantEffectiveJurisdiction(tenantId: string): Jurisdiction | null;
    /**
     * Checks if a tenant is fully compliant across all data placements.
     *
     * @param tenantId - The tenant identifier
     * @returns True if all placements are compliant
     */
    isTenantCompliant(tenantId: string): boolean;
    /**
     * Gets a summary of compliance status for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Compliance summary
     */
    getTenantComplianceSummary(tenantId: string): {
        isCompliant: boolean;
        totalPlacements: number;
        compliantPlacements: number;
        nonCompliantPlacements: number;
        openViolations: number;
        resolvedViolations: number;
        effectiveJurisdiction: Jurisdiction | null;
        primaryRegion: DataRegion | null;
    };
}
