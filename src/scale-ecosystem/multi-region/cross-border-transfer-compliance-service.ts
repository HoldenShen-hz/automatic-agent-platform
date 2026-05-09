import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface CrossBorderTransferRequest {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly sourceJurisdiction: string;
  readonly targetJurisdiction: string;
  readonly dataCategories: readonly string[];
  readonly containsPii: boolean;
  readonly purpose: string;
  readonly payload?: Record<string, unknown> | null;
  readonly allowedDataFields?: readonly string[];
  readonly preferredMechanism?: "scc" | "bcr" | "dpf";
  /** R15-54: Target region's data residency policy - enforces local_only blocking */
  readonly dataResidencyPolicy?: "local_only" | "regional" | "global";
}

export interface CrossBorderTransferAssessment {
  readonly allowed: boolean;
  readonly jurisdictionClassifier: {
    readonly isCrossBorder: boolean;
    readonly sourceJurisdiction: string;
    readonly targetJurisdiction: string;
  };
  readonly transferImpactAssessment: {
    readonly riskLevel: "low" | "medium" | "high";
    readonly reasons: readonly string[];
  };
  readonly mechanismSelection: {
    readonly mechanism: "none_required" | "scc" | "bcr" | "dpf" | "blocked";
    readonly rationale: string;
  };
  readonly dataMinimizer: {
    readonly minimizedPayload: Record<string, unknown> | null;
    readonly removedFields: readonly string[];
  };
  readonly outputScanner: {
    readonly blockedFindings: readonly string[];
    readonly passed: boolean;
  };
  readonly transferLog: {
    readonly transferLogId: string;
    readonly recordedAt: string;
    readonly sourceRegionId: string;
    readonly targetRegionId: string;
    readonly mechanism: "none_required" | "scc" | "bcr" | "dpf" | "blocked";
    readonly allowed: boolean;
  };
}

export class CrossBorderTransferComplianceService {
  private readonly transferLog: CrossBorderTransferAssessment["transferLog"][] = [];

  public assessTransfer(request: CrossBorderTransferRequest): CrossBorderTransferAssessment {
    const isCrossBorder = request.sourceJurisdiction !== request.targetJurisdiction;
    const reasons: string[] = [];
    if (isCrossBorder) {
      reasons.push("multi_region.cross_border_transfer");
    }
    if (request.containsPii) {
      reasons.push("multi_region.contains_pii");
    }

    // R15-54: Enforce data residency policy - local_only blocks all cross-border transfers
    if (request.dataResidencyPolicy === "local_only" && isCrossBorder) {
      const assessment = this.buildBlockedAssessment(request, "local_only_residency_policy", reasons);
      return assessment;
    }

    const riskLevel: CrossBorderTransferAssessment["transferImpactAssessment"]["riskLevel"] = isCrossBorder
      ? request.containsPii ? "high" : "medium"
      : "low";
    const mechanism = selectMechanism(request, isCrossBorder, riskLevel);
    const minimizedPayload = minimizePayload(request.payload ?? null, request.allowedDataFields ?? []);
    const blockedFindings = scanOutput(request, minimizedPayload);
    const allowed = mechanism !== "blocked" && blockedFindings.length === 0;
    const assessment: CrossBorderTransferAssessment = {
      allowed,
      jurisdictionClassifier: {
        isCrossBorder,
        sourceJurisdiction: request.sourceJurisdiction,
        targetJurisdiction: request.targetJurisdiction,
      },
      transferImpactAssessment: {
        riskLevel,
        reasons,
      },
      mechanismSelection: {
        mechanism,
        rationale: allowed
          ? `multi_region.transfer_mechanism:${mechanism}`
          : "multi_region.transfer_blocked",
      },
      dataMinimizer: {
        minimizedPayload,
        removedFields: request.payload == null || request.allowedDataFields == null
          ? []
          : Object.keys(request.payload).filter((field) => !request.allowedDataFields!.includes(field)),
      },
      outputScanner: {
        blockedFindings,
        passed: blockedFindings.length === 0,
      },
      transferLog: {
        transferLogId: newId("transfer_log"),
        recordedAt: nowIso(),
        sourceRegionId: request.sourceRegionId,
        targetRegionId: request.targetRegionId,
        mechanism,
        allowed,
      },
    };
    this.transferLog.push(assessment.transferLog);
    return assessment;
  }

  public getTransferLog(): readonly CrossBorderTransferAssessment["transferLog"][] {
    return [...this.transferLog];
  }

  /**
   * R15-54: Build a blocked assessment for rejected transfers.
   * Used when data residency policy or other compliance rules block a transfer.
   */
  private buildBlockedAssessment(
    request: CrossBorderTransferRequest,
    blockReason: string,
    reasons: readonly string[],
  ): CrossBorderTransferAssessment {
    const assessment: CrossBorderTransferAssessment = {
      allowed: false,
      jurisdictionClassifier: {
        isCrossBorder: request.sourceJurisdiction !== request.targetJurisdiction,
        sourceJurisdiction: request.sourceJurisdiction,
        targetJurisdiction: request.targetJurisdiction,
      },
      transferImpactAssessment: {
        riskLevel: "high",
        reasons: [...reasons, blockReason],
      },
      mechanismSelection: {
        mechanism: "blocked",
        rationale: `multi_region.transfer_blocked:${blockReason}`,
      },
      dataMinimizer: {
        minimizedPayload: null,
        removedFields: [],
      },
      outputScanner: {
        blockedFindings: [blockReason],
        passed: false,
      },
      transferLog: {
        transferLogId: newId("transfer_log"),
        recordedAt: nowIso(),
        sourceRegionId: request.sourceRegionId,
        targetRegionId: request.targetRegionId,
        mechanism: "blocked",
        allowed: false,
      },
    };
    this.transferLog.push(assessment.transferLog);
    return assessment;
  }
}

function selectMechanism(
  request: CrossBorderTransferRequest,
  isCrossBorder: boolean,
  riskLevel: "low" | "medium" | "high",
): "none_required" | "scc" | "bcr" | "dpf" | "blocked" {
  if (!isCrossBorder) {
    return "none_required";
  }
  if (riskLevel === "high" && request.preferredMechanism == null && request.containsPii) {
    return "blocked";
  }
  return request.preferredMechanism ?? "scc";
}

function minimizePayload(
  payload: Record<string, unknown> | null,
  allowedDataFields: readonly string[],
): Record<string, unknown> | null {
  if (payload == null || allowedDataFields.length === 0) {
    return payload;
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) => allowedDataFields.includes(field)),
  );
}

function scanOutput(
  request: CrossBorderTransferRequest,
  minimizedPayload: Record<string, unknown> | null,
): string[] {
  const findings: string[] = [];
  if (request.containsPii && request.allowedDataFields != null && request.allowedDataFields.length === 0) {
    findings.push("multi_region.pii_without_minimization");
  }
  if (request.containsPii && minimizedPayload != null && Object.keys(minimizedPayload).some((field) => field.toLowerCase().includes("ssn"))) {
    findings.push("multi_region.high_risk_identifier_present");
  }
  return findings;
}
