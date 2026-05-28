export type RiskSeverity = "P0" | "P1" | "P2" | "P3";
export type RiskLikelihood = "low" | "medium" | "high";
export type RiskStatus = "open" | "mitigated" | "accepted" | "transferred";

export interface RiskRegisterRecord {
  readonly riskId: string;
  readonly severity: RiskSeverity;
  readonly likelihood: RiskLikelihood;
  readonly impact: string;
  readonly owner: string;
  readonly mitigation: string;
  readonly testOrDrill: string;
  readonly status: RiskStatus;
  readonly reviewAfter: string;
  readonly trigger: string;
  readonly linkedInvariant: string;
  readonly linkedTest: string;
}

export const PLATFORM_RISK_REGISTER_BASELINE: readonly RiskRegisterRecord[] = Object.freeze([
  {
    riskId: "RISK-GRAPH-001",
    severity: "P0",
    likelihood: "medium",
    impact: "PlanGraph validation gaps can create deadlocks, unreachable terminals, or missing compensation paths.",
    owner: "Orchestration",
    mitigation: "PlanGraph must pass normalize, validate, risk propagation, and worst-path analysis before dispatch.",
    testOrDrill: "GraphPatch and PlanGraph validation regression suite.",
    status: "mitigated",
    reviewAfter: "2026-06-15",
    trigger: "Graph validation finding or scheduler replay mismatch.",
    linkedInvariant: "INV-GRAPH-001",
    linkedTest: "tests/unit/platform/five-plane-orchestration/harness/runtime/plan-graph-harness-runtime.test.ts",
  },
  {
    riskId: "RISK-SIDEEFFECT-001",
    severity: "P0",
    likelihood: "medium",
    impact: "Ambiguous external state can be incorrectly treated as success and drift from platform truth.",
    owner: "Execution",
    mitigation: "SideEffectManager forces ambiguous outcomes into reconciliation or manual review.",
    testOrDrill: "Side-effect reconciliation and compensation regression suite.",
    status: "mitigated",
    reviewAfter: "2026-06-22",
    trigger: "Ambiguous tool/API result or missing external confirmation.",
    linkedInvariant: "INV-SIDEEFFECT-001",
    linkedTest: "tests/unit/platform/five-plane-execution/side-effect-manager.test.ts",
  },
  {
    riskId: "RISK-BUDGET-001",
    severity: "P1",
    likelihood: "medium",
    impact: "Missing reservation can amplify retry, replan, tool, or evaluation cost.",
    owner: "Finance Platform",
    mitigation: "BudgetAllocator hard-cap reservation is required before cost-bearing execution.",
    testOrDrill: "Budget hard-cap concurrency regression suite.",
    status: "mitigated",
    reviewAfter: "2026-07-08",
    trigger: "Reservation rejection, hard-cap reached, or settlement mismatch.",
    linkedInvariant: "INV-BUDGET-001",
    linkedTest: "tests/unit/platform/five-plane-execution/budget-allocator.test.ts",
  },
  {
    riskId: "RISK-DOMAIN-001",
    severity: "P1",
    likelihood: "medium",
    impact: "High-risk domain behavior can ship without explicit accountability or regulatory evidence.",
    owner: "Domain Platform",
    mitigation: "Every §71-§94 domain has a domain-spec.md with hard constraints and acceptance evidence entry.",
    testOrDrill: "Domain spec coverage invariant test.",
    status: "mitigated",
    reviewAfter: "2026-07-15",
    trigger: "New domain directory, changed risk level, or missing domain spec.",
    linkedInvariant: "INV-DOMAIN-001",
    linkedTest: "tests/invariants/domain-spec-coverage.test.ts",
  },
  {
    riskId: "RISK-RECOVERY-001",
    severity: "P1",
    likelihood: "medium",
    impact: "Recovery or replay drift can resume a run from a stale checkpoint and duplicate external side effects.",
    owner: "State Evidence",
    mitigation: "Checkpoint restore paths must prove idempotency, replay ordering, and side-effect reconciliation before resume.",
    testOrDrill: "Runtime recovery and checkpoint replay regression suite.",
    status: "mitigated",
    reviewAfter: "2026-08-01",
    trigger: "Recovery mismatch, duplicate side effect, or checkpoint integrity failure.",
    linkedInvariant: "INV-RECOVERY-001",
    linkedTest: "tests/unit/platform/orchestration/harness/recovery-controller.test.ts",
  },
  {
    riskId: "RISK-WEB-001",
    severity: "P2",
    likelihood: "medium",
    impact: "Web shell auth or route normalization mistakes can expose features or stale client state to the wrong operator.",
    owner: "Interface Platform",
    mitigation: "Web runtime must require explicit auth context, sanitize route resolution, and fail closed on bootstrap errors.",
    testOrDrill: "UI runtime and route-guard regression suite.",
    status: "mitigated",
    reviewAfter: "2026-08-15",
    trigger: "Auth bypass finding, route confusion, or startup bootstrap failure.",
    linkedInvariant: "INV-WEB-001",
    linkedTest: "ui/tests/unit/ui/apps/web/runtime.test.tsx",
  },
]);

export class RiskRegister {
  public list(): readonly RiskRegisterRecord[] {
    return PLATFORM_RISK_REGISTER_BASELINE;
  }

  public resolve(riskId: string): RiskRegisterRecord {
    const risk = PLATFORM_RISK_REGISTER_BASELINE.find((item) => item.riskId === riskId);
    if (risk == null) {
      throw new Error(`Unknown risk register record: ${riskId}`);
    }
    return risk;
  }

  public assertReleaseGateReady(): void {
    for (const risk of PLATFORM_RISK_REGISTER_BASELINE) {
      assertRequiredField(risk.riskId, "impact", risk.impact);
      assertRequiredField(risk.riskId, "owner", risk.owner);
      assertRequiredField(risk.riskId, "mitigation", risk.mitigation);
      assertRequiredField(risk.riskId, "testOrDrill", risk.testOrDrill);
      assertRequiredField(risk.riskId, "linkedInvariant", risk.linkedInvariant);
      assertRequiredField(risk.riskId, "linkedTest", risk.linkedTest);
    }
  }
}

export function listRiskRegisterRecords(): readonly RiskRegisterRecord[] {
  return new RiskRegister().list();
}

function assertRequiredField(riskId: string, fieldName: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Risk register record ${riskId} is missing ${fieldName}`);
  }
}
