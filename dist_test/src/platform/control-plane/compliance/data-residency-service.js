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
/**
 * Default residency rules per jurisdiction
 */
const DEFAULT_RESIDENCY_RULES = {
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
const REGION_JURISDICTION_MAP = {
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
function isValidRegion(region) {
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
    db;
    store;
    constructor(db, store) {
        this.db = db;
        this.store = store;
    }
    /**
     * Gets the jurisdiction for a given region.
     *
     * @param region - The data region
     * @returns The jurisdiction
     */
    getJurisdictionForRegion(region) {
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
    getResidencyRule(jurisdiction) {
        return DEFAULT_RESIDENCY_RULES[jurisdiction];
    }
    /**
     * Checks if data placement is compliant with residency requirements.
     *
     * @param input - The placement to check
     * @returns Compliance check result
     */
    checkResidency(input) {
        const currentJurisdiction = this.getJurisdictionForRegion(input.currentRegion);
        const rule = this.getResidencyRule(currentJurisdiction);
        const violations = [];
        // Check data localization requirement
        if (rule.dataLocalizationRequired && currentJurisdiction !== "EU" && input.category === "personal") {
            // EU requires personal data to stay in EU
            violations.push(`Data localization required for ${input.category} data in EU jurisdiction, but data is in ${input.currentRegion}`);
        }
        // Check cross-border transfer restrictions
        if (!rule.crossBorderTransfersAllowed && currentJurisdiction !== "OTHER") {
            violations.push(`Cross-border transfers not allowed for ${currentJurisdiction} jurisdiction`);
        }
        const isCompliant = violations.length === 0;
        // Record the placement
        this.db.transaction(() => {
            const placement = {
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
                const violation = {
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
    validateDataPlacement(input) {
        const targetJurisdiction = this.getJurisdictionForRegion(input.targetRegion);
        const rule = this.getResidencyRule(targetJurisdiction);
        // Check if target jurisdiction allows the data category
        if (rule.dataLocalizationRequired && input.category === "personal" && targetJurisdiction !== "EU") {
            throw new PolicyDeniedError(`residency.placement_not_allowed:${input.targetRegion}`, `Cannot place personal data in ${input.targetRegion} as EU data localization is required`, {
                details: { region: input.targetRegion, category: input.category, jurisdiction: targetJurisdiction },
            });
        }
        // Check cross-border transfer restrictions
        if (!rule.crossBorderTransfersAllowed && targetJurisdiction !== "OTHER") {
            throw new PolicyDeniedError(`residency.cross_border_not_allowed:${input.targetRegion}`, `Cross-border transfers to ${targetJurisdiction} are not allowed`, {
                details: { region: input.targetRegion, jurisdiction: targetJurisdiction },
            });
        }
    }
    /**
     * Lists all residency violations for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @param includeResolved - Whether to include resolved violations
     * @returns Array of violations
     */
    listResidencyViolations(tenantId, includeResolved = false) {
        const violations = this.store.compliance.listResidencyViolationsByTenant(tenantId);
        if (includeResolved) {
            return violations.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
        }
        return violations
            .filter((v) => v.resolvedAt === null)
            .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
    }
    /**
     * Resolves a residency violation.
     *
     * @param violationId - The violation ID
     * @param resolutionNotes - Notes on how the violation was resolved
     * @returns The resolved violation
     */
    resolveViolation(violationId, resolutionNotes) {
        return this.db.transaction(() => {
            const violations = this.store.compliance.listAllResidencyViolations();
            const violation = violations.find((v) => v.violationId === violationId);
            if (!violation) {
                throw new ValidationError(`residency.violation_not_found:${violationId}`, `Residency violation not found: ${violationId}`, {
                    details: { violationId },
                });
            }
            const resolved = {
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
    listDataPlacements(tenantId) {
        return this.store.compliance.listDataPlacementsByTenant(tenantId);
    }
    /**
     * Gets the primary region for a tenant based on their data placements.
     *
     * @param tenantId - The tenant identifier
     * @returns The primary region or null if no placements recorded
     */
    getTenantPrimaryRegion(tenantId) {
        const placements = this.store.compliance.listDataPlacementsByTenant(tenantId);
        if (placements.length === 0) {
            return null;
        }
        // Find the most recent placement
        const sorted = [...placements].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
        return sorted[0].currentRegion;
    }
    /**
     * Gets the effective jurisdiction for a tenant based on their data placements.
     *
     * @param tenantId - The tenant identifier
     * @returns The jurisdiction or null if no placements recorded
     */
    getTenantEffectiveJurisdiction(tenantId) {
        const placements = this.store.compliance.listDataPlacementsByTenant(tenantId);
        if (placements.length === 0) {
            return null;
        }
        // Find the most recent placement
        const sorted = [...placements].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
        return sorted[0].currentJurisdiction;
    }
    /**
     * Checks if a tenant is fully compliant across all data placements.
     *
     * @param tenantId - The tenant identifier
     * @returns True if all placements are compliant
     */
    isTenantCompliant(tenantId) {
        const violations = this.listResidencyViolations(tenantId, false);
        return violations.length === 0;
    }
    /**
     * Gets a summary of compliance status for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Compliance summary
     */
    getTenantComplianceSummary(tenantId) {
        const placements = this.store.compliance.listDataPlacementsByTenant(tenantId);
        const violations = this.store.compliance.listResidencyViolationsByTenant(tenantId);
        const compliantPlacements = placements.filter((p) => p.isCompliant).length;
        const openViolations = violations.filter((v) => v.resolvedAt === null).length;
        const resolvedViolations = violations.filter((v) => v.resolvedAt !== null).length;
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
//# sourceMappingURL=data-residency-service.js.map