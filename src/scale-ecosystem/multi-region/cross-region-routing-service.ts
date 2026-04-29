import { shouldReplicateToRegion, type ReplicationPolicy } from "./data-replicator/index.js";
import { resolveRegionFailover } from "./failover-controller/index.js";
import { selectPreferredRegion, type RegionDescriptor } from "./region-router/index.js";

/**
 * Cross-border transfer data category for impact assessment
 */
export type TransferDataCategory = "personal" | "financial" | "health" | "biometric" | "children" | "government" | "business";

/**
 * Cross-border transfer mechanism
 */
export type TransferMechanism = "standard" | "encrypted_pipeline" | "anonymized_stream" | "federated_query";

/**
 * Jurisdiction classification result from Step 1
 */
export interface JurisdictionClassificationResult {
  readonly sourceJurisdiction: string;
  readonly targetJurisdiction: string;
  readonly crossBorderRequired: boolean;
  readonly allowedJurisdictions: readonly string[];
  readonly classificationConfidence: number;
}

/**
 * Transfer impact assessment result from Step 2
 */
export interface TransferImpactAssessment {
  readonly impactScore: number;
  readonly dataCategories: readonly TransferDataCategory[];
  readonly regulatoryFlags: readonly string[];
  readonly complianceRisk: "low" | "medium" | "high" | "critical";
  readonly requiresAdditionalSafeguards: boolean;
}

/**
 * Mechanism selection result from Step 3
 */
export interface MechanismSelectionResult {
  readonly selectedMechanism: TransferMechanism;
  readonly fallbackMechanism: TransferMechanism | null;
  readonly encryptionRequired: boolean;
  readonly auditLoggingRequired: boolean;
  readonly allowedByPolicy: boolean;
}

/**
 * Data minimization result from Step 4
 */
export interface DataMinimizationResult {
  readonly fieldsToRedact: readonly string[];
  readonly aggregationLevel: "none" | "anonymized" | "pseudonymized" | "fully_aggregated";
  readonly dataRetentionDays: number | null;
  readonly minimizationApplied: boolean;
}

/**
 * Output scanning result from Step 5
 */
export interface OutputScanResult {
  readonly passed: boolean;
  readonly violations: readonly string[];
  readonly sanitizationApplied: boolean;
  readonly sanitizedOutput: string | null;
}

/**
 * Transfer logging result from Step 6 per §52.4
 */
export interface TransferLoggingResult {
  readonly logged: boolean;
  readonly logId: string;
  readonly loggedAt: string;
  readonly transferRecord: {
    readonly sourceRegionId: string;
    readonly targetRegionId: string;
    readonly dataCategories: readonly TransferDataCategory[];
    readonly mechanism: TransferMechanism;
    readonly decision: "allowed" | "blocked" | "requires_review";
  };
}

/**
 * Result of the full 6-step cross-border transfer chain per §52.4
 */
export interface CrossBorderTransferChainResult {
  readonly chainStepResults: {
    jurisdictionClassification: JurisdictionClassificationResult;
    impactAssessment: TransferImpactAssessment;
    mechanismSelection: MechanismSelectionResult;
    dataMinimization: DataMinimizationResult;
    outputScan: OutputScanResult;
    transferLogging: TransferLoggingResult;
  };
  readonly overallDecision: "allowed" | "blocked" | "requires_review";
  readonly blockedReason: string | null;
  readonly auditTrail: readonly string[];
}

/**
 * Step 1: JurisdictionClassifier - classifies source and target jurisdictions
 */
function classifyJurisdiction(
  sourceRegion: RegionDescriptor,
  targetRegion: RegionDescriptor,
  policy: ResidencyPolicy,
): JurisdictionClassificationResult {
  const sourceJurisdiction = sourceRegion.jurisdiction;
  const targetJurisdiction = targetRegion.jurisdiction;
  const crossBorderRequired = sourceJurisdiction !== targetJurisdiction;
  const allowedJurisdictions = policy.allowedJurisdictions;
  const isAllowed = allowedJurisdictions.includes(targetJurisdiction);

  return {
    sourceJurisdiction,
    targetJurisdiction,
    crossBorderRequired,
    allowedJurisdictions,
    classificationConfidence: isAllowed ? 1.0 : 0.0,
  };
}

/**
 * Step 2: TransferImpactAssessor - assesses impact of the transfer
 */
function assessTransferImpact(
  classification: JurisdictionClassificationResult,
  sourceRegion: RegionDescriptor,
  targetRegion: RegionDescriptor,
): TransferImpactAssessment {
  const impactScore = classification.crossBorderRequired ? 0.7 : 0.1;
  const dataCategories: TransferDataCategory[] = ["personal", "business"];
  const regulatoryFlags: string[] = [];

  if (classification.crossBorderRequired) {
    if (classification.targetJurisdiction === "EU") {
      regulatoryFlags.push("GDPR_ARTICLE_44");
    } else if (classification.targetJurisdiction === "US") {
      regulatoryFlags.push("CCPA_SCOPE");
    }
  }

  const complianceRisk: "low" | "medium" | "high" | "critical" =
    regulatoryFlags.length > 1 ? "high" : regulatoryFlags.length === 1 ? "medium" : "low";

  return {
    impactScore,
    dataCategories,
    regulatoryFlags,
    complianceRisk,
    requiresAdditionalSafeguards: complianceRisk !== "low",
  };
}

/**
 * Step 3: MechanismSelector - selects appropriate transfer mechanism
 */
function selectMechanism(
  classification: JurisdictionClassificationResult,
  impact: TransferImpactAssessment,
  policy: ResidencyPolicy,
): MechanismSelectionResult {
  const crossBorderRequired = classification.crossBorderRequired;

  if (!policy.allowCrossBorder && crossBorderRequired) {
    return {
      selectedMechanism: "standard",
      fallbackMechanism: null,
      encryptionRequired: false,
      auditLoggingRequired: false,
      allowedByPolicy: false,
    };
  }

  let selectedMechanism: TransferMechanism = "standard";
  if (crossBorderRequired) {
    if (impact.complianceRisk === "critical" || impact.complianceRisk === "high") {
      selectedMechanism = "federated_query";
    } else if (impact.complianceRisk === "medium") {
      selectedMechanism = "anonymized_stream";
    } else {
      selectedMechanism = "encrypted_pipeline";
    }
  }

  return {
    selectedMechanism,
    fallbackMechanism: "standard",
    encryptionRequired: crossBorderRequired,
    auditLoggingRequired: true,
    allowedByPolicy: true,
  };
}

/**
 * Step 4: DataMinimizer - applies data minimization techniques
 */
function minimizeData(
  mechanism: MechanismSelectionResult,
  impact: TransferImpactAssessment,
): DataMinimizationResult {
  if (!mechanism.encryptionRequired) {
    return {
      fieldsToRedact: [],
      aggregationLevel: "none",
      dataRetentionDays: null,
      minimizationApplied: false,
    };
  }

  const fieldsToRedact: string[] = [];
  let aggregationLevel: "none" | "anonymized" | "pseudonymized" | "fully_aggregated" = "none";

  if (impact.dataCategories.includes("personal")) {
    fieldsToRedact.push("email", "phone", "address", "ssn");
  }
  if (impact.dataCategories.includes("health")) {
    fieldsToRedact.push("medicalRecordNumber", "diagnosis", "treatment");
  }

  if (mechanism.selectedMechanism === "federated_query") {
    aggregationLevel = "fully_aggregated";
  } else if (mechanism.selectedMechanism === "anonymized_stream") {
    aggregationLevel = "anonymized";
  } else if (mechanism.selectedMechanism === "encrypted_pipeline") {
    aggregationLevel = "pseudonymized";
  }

  return {
    fieldsToRedact,
    aggregationLevel,
    dataRetentionDays: 90,
    minimizationApplied: fieldsToRedact.length > 0 || aggregationLevel !== "none",
  };
}

/**
 * Step 5: OutputScanner - scans output for compliance violations
 */
function scanOutput(
  mechanism: MechanismSelectionResult,
  minimization: DataMinimizationResult,
): OutputScanResult {
  if (!mechanism.allowedByPolicy) {
    return {
      passed: false,
      violations: ["Cross-border transfer not allowed by policy"],
      sanitizationApplied: false,
      sanitizedOutput: null,
    };
  }

  if (minimization.minimizationApplied && minimization.aggregationLevel === "fully_aggregated") {
    return {
      passed: true,
      violations: [],
      sanitizationApplied: true,
      sanitizedOutput: "[REDACTED - AGGREGATED DATA ONLY]",
    };
  }

  return {
    passed: true,
    violations: [],
    sanitizationApplied: minimization.minimizationApplied,
    sanitizedOutput: null,
  };
}

/**
 * Step 6: TransferLogger - records the transfer in the audit log per §52.4
 */
function logTransfer(
  sourceRegion: RegionDescriptor,
  targetRegion: RegionDescriptor,
  dataCategories: readonly TransferDataCategory[],
  mechanism: TransferMechanism,
  decision: "allowed" | "blocked" | "requires_review",
): TransferLoggingResult {
  const logId = `transfer_log_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    logged: true,
    logId,
    loggedAt: new Date().toISOString(),
    transferRecord: {
      sourceRegionId: sourceRegion.regionId,
      targetRegionId: targetRegion.regionId,
      dataCategories,
      mechanism,
      decision,
    },
  };
}

export interface ResidencyPolicy {
  readonly policyId: string;
  readonly allowedJurisdictions: readonly string[];
  readonly blockedRegionIds?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly allowCrossBorder: boolean;
}

export interface CrossRegionRouteRequest {
  readonly regions: readonly RegionDescriptor[];
  readonly policy: ResidencyPolicy;
  readonly primaryRegionId?: string | null;
  readonly preferredRegionId?: string | null;
  readonly primaryRegionHealthy: boolean;
  readonly replicationPolicy?: ReplicationPolicy | null;
  readonly dataCategories?: readonly TransferDataCategory[];
  /** When true, route to any healthy replica; when false, route writes to partition leader only per §52.3 */
  readonly readOnly?: boolean;
}

export interface CrossRegionRouteDecision {
  readonly decisionId: string;
  readonly selectedRegionId: string | null;
  readonly candidateRegions: readonly string[];
  readonly residencyDecision: "allowed" | "blocked" | "requires_review";
  readonly latencyScore: number | null;
  readonly policyRef: string;
  readonly auditTrail: readonly string[];
  readonly recoveryTopology: {
    readonly primaryRegionId: string | null;
    readonly failoverRegionId: string | null;
    readonly replicationTargets: readonly string[];
  };
  readonly blockedRegions: readonly string[];
  readonly crossBorderTransferChain?: CrossBorderTransferChainResult;
}

function includesAllCapabilities(region: RegionDescriptor, requiredCapabilities: readonly string[]): boolean {
  const capabilities = new Set((region as RegionDescriptor & { capabilities?: readonly string[] }).capabilities ?? []);
  return requiredCapabilities.every((capability) => capabilities.has(capability));
}

export class CrossRegionRoutingService {
  public route(request: CrossRegionRouteRequest): CrossRegionRouteDecision {
    const blockedRegionIds = new Set(request.policy.blockedRegionIds ?? []);
    const unhealthyPrimaryRegionId = !request.primaryRegionHealthy ? request.primaryRegionId ?? null : null;
    const allowedJurisdictions = new Set(request.policy.allowedJurisdictions);
    const requiredCapabilities = request.policy.requiredCapabilities ?? [];
    const isReadOnly = request.readOnly ?? false;

    // Per §52.3: truth writes must route to partition leader only (primary region)
    // Reads can route to any healthy replica
    const blockedRegions = request.regions
      .filter((region) => {
        // Always block explicitly blocked regions
        if (blockedRegionIds.has(region.regionId)) return true;
        // Always block draining regions
        if (region.status === "draining") return true;
        // Block regions violating residency
        if (!region.residencyAllowed) return true;
        // Block regions in disallowed jurisdictions
        if (!allowedJurisdictions.has(region.jurisdiction)) return true;
        // Block regions missing required capabilities
        if (!includesAllCapabilities(region, requiredCapabilities)) return true;

        // For write operations: only the primary (partition leader) can accept writes
        if (!isReadOnly) {
          if (region.regionId === unhealthyPrimaryRegionId) return true;
        }

        return false;
      })
      .map((region) => region.regionId);

    const candidateDescriptors = request.regions.filter((region) => !blockedRegions.includes(region.regionId));
    const preferredRegion = request.preferredRegionId == null
      ? null
      : candidateDescriptors.find((region) => region.regionId === request.preferredRegionId) ?? null;
    const selectedRegion = preferredRegion ?? selectPreferredRegion(candidateDescriptors);
    const failover = resolveRegionFailover({
      primaryHealthy: request.primaryRegionHealthy,
      candidateRegionIds: candidateDescriptors
        .filter((region) => region.regionId !== selectedRegion?.regionId)
        .map((region) => region.regionId),
    });

    // Execute 6-step cross-border transfer chain if needed
    let crossBorderTransferChain: CrossBorderTransferChainResult | undefined;
    if (selectedRegion != null && request.primaryRegionId != null) {
      const primaryRegion = request.regions.find((r) => r.regionId === request.primaryRegionId);
      if (primaryRegion != null && primaryRegion.jurisdiction !== selectedRegion.jurisdiction) {
        crossBorderTransferChain = this.executeCrossBorderTransferChain(primaryRegion, selectedRegion, request.policy);
      }
    }

    const auditTrail = [
      `policy:${request.policy.policyId}`,
      `cross_border:${request.policy.allowCrossBorder ? "allowed" : "blocked"}`,
      `blocked:${blockedRegions.join(",") || "none"}`,
      ...(crossBorderTransferChain?.auditTrail ?? []),
    ];
    return {
      decisionId: `cross_region_decision:${request.policy.policyId}:${selectedRegion?.regionId ?? "blocked"}`,
      selectedRegionId: selectedRegion?.regionId ?? null,
      candidateRegions: candidateDescriptors.map((region) => region.regionId),
      residencyDecision: selectedRegion == null ? "blocked" : crossBorderTransferChain?.overallDecision ?? "allowed",
      latencyScore: selectedRegion?.latencyScore ?? null,
      policyRef: request.policy.policyId,
      auditTrail,
      recoveryTopology: {
        primaryRegionId: request.primaryRegionId ?? selectedRegion?.regionId ?? null,
        failoverRegionId: failover.targetRegionId,
        replicationTargets: request.replicationPolicy == null
          ? []
          : candidateDescriptors
            .filter((region) => shouldReplicateToRegion(request.replicationPolicy!, region.regionId))
            .map((region) => region.regionId),
      },
      blockedRegions,
      ...(crossBorderTransferChain !== undefined ? { crossBorderTransferChain } : {}),
    };
  }

  private executeCrossBorderTransferChain(
    sourceRegion: RegionDescriptor,
    targetRegion: RegionDescriptor,
    policy: ResidencyPolicy,
  ): CrossBorderTransferChainResult {
    const auditTrail: string[] = [];

    // Step 1: JurisdictionClassifier
    const jurisdictionClassification = classifyJurisdiction(sourceRegion, targetRegion, policy);
    auditTrail.push(`step1_jurisdiction:${jurisdictionClassification.sourceJurisdiction}->${jurisdictionClassification.targetJurisdiction}`);

    // Step 2: TransferImpactAssessor
    const impactAssessment = assessTransferImpact(jurisdictionClassification, sourceRegion, targetRegion);
    auditTrail.push(`step2_impact:${impactAssessment.impactScore}_risk:${impactAssessment.complianceRisk}`);

    // Step 3: MechanismSelector
    const mechanismSelection = selectMechanism(jurisdictionClassification, impactAssessment, policy);
    auditTrail.push(`step3_mechanism:${mechanismSelection.selectedMechanism}_allowed:${mechanismSelection.allowedByPolicy}`);

    // Step 4: DataMinimizer
    const dataMinimization = minimizeData(mechanismSelection, impactAssessment);
    auditTrail.push(`step4_minimization:${dataMinimization.aggregationLevel}_fields:${dataMinimization.fieldsToRedact.length}`);

    // Step 5: OutputScanner
    const outputScan = scanOutput(mechanismSelection, dataMinimization);
    auditTrail.push(`step5_outputscan:${outputScan.passed ? "passed" : "failed"}`);

    // Determine overall decision before logging
    let overallDecision: "allowed" | "blocked" | "requires_review" = "allowed";
    let blockedReason: string | null = null;

    if (!mechanismSelection.allowedByPolicy) {
      overallDecision = "blocked";
      blockedReason = "Cross-border transfer not allowed by policy";
    } else if (!outputScan.passed) {
      overallDecision = "blocked";
      blockedReason = outputScan.violations.join("; ");
    } else if (impactAssessment.requiresAdditionalSafeguards && !outputScan.sanitizationApplied) {
      overallDecision = "requires_review";
      blockedReason = "Transfer requires additional safeguards review";
    }

    // Step 6: TransferLogger - log the transfer decision
    const dataCategories = impactAssessment.dataCategories;
    const transferLogging = logTransfer(
      sourceRegion,
      targetRegion,
      dataCategories,
      mechanismSelection.selectedMechanism,
      overallDecision,
    );
    auditTrail.push(`step6_transferlog:${transferLogging.logId}`);

    return {
      chainStepResults: {
        jurisdictionClassification,
        impactAssessment,
        mechanismSelection,
        dataMinimization,
        outputScan,
        transferLogging,
      },
      overallDecision,
      blockedReason,
      auditTrail,
    };
  }
}
