export interface ComplianceReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly summary: Record<string, unknown>;
  readonly passedChecks: number;
}

export interface PolicyCheck {
  readonly policyId: string;
  readonly policyName: string;
  readonly description: string;
  readonly applicableRules: readonly string[];
  readonly checkedAt: string;
  readonly passed: boolean;
  readonly details: Record<string, unknown>;
}

export interface ViolationRecord {
  readonly violationId: string;
  readonly policyId: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly entityType: string;
  readonly entityId: string;
  readonly description: string;
  readonly detectedAt: string;
  readonly remediatedAt: string | null;
}
