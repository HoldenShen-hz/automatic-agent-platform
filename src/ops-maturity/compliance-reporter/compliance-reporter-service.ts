import { nowIso } from "../../platform/contracts/types/ids.js";
import type { ComplianceReport, PolicyCheck, ViolationRecord } from "./types.js";

export class ComplianceReporterService {
  private readonly violations: ViolationRecord[] = [];
  private readonly defaultActiveViolationLimit = 100;

  public async generateReport(input: {
    readonly tenantId: string;
    readonly periodStart: string;
    readonly periodEnd: string;
  }): Promise<ComplianceReport> {
    const activeViolations = this.getActiveViolations(input.tenantId);
    return {
      reportId: `compliance_${input.tenantId}`,
      tenantId: input.tenantId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      summary: {
        activeViolations: activeViolations.length,
        generatedAt: nowIso(),
      },
      passedChecks: Math.max(0, 3 - activeViolations.length),
    };
  }

  public recordViolation(violation: ViolationRecord): void {
    this.violations.push(violation);
  }

  public getActiveViolations(_tenantId: string, limit = this.defaultActiveViolationLimit): ViolationRecord[] {
    return this.violations
      .filter((item) => item.remediatedAt == null)
      .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt))
      .slice(0, Math.max(1, limit));
  }

  public async executeCheck(_tenantId: string, check: PolicyCheck): Promise<PolicyCheck> {
    return check;
  }

  public async exportAuditTrail(input: {
    readonly tenantId: string;
    readonly format: "json" | "markdown";
  }): Promise<{ readonly format: "json" | "markdown"; readonly content: string }> {
    const content = input.format === "json"
      ? JSON.stringify(this.getActiveViolations(input.tenantId))
      : this.getActiveViolations(input.tenantId).map((item) => `${item.policyId}:${item.description}`).join("\n");
    return {
      format: input.format,
      content,
    };
  }
}
