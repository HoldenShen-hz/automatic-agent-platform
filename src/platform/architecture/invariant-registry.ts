export type ArchitectureInvariantPhase = "MVP" | "Hardening" | "Enterprise";

export type ArchitectureInvariantCategory =
  | "RuntimeInvariant"
  | "SecurityInvariant"
  | "AuditInvariant"
  | "PolicyInvariant"
  | "DomainInvariant"
  | "RiskInvariant";

export interface ArchitectureInvariant {
  readonly invariantId: string;
  readonly statement: string;
  readonly category: ArchitectureInvariantCategory;
  readonly enforcementPoint: string;
  readonly testRef: string;
  readonly failureBehavior: string;
  readonly owner: string;
  readonly phase: ArchitectureInvariantPhase;
  readonly nonOverridable: boolean;
}

export const ARCHITECTURE_INVARIANTS: readonly ArchitectureInvariant[] = Object.freeze([
  {
    invariantId: "INV-STATE-001",
    statement: "Every HarnessRun or NodeRun truth mutation must append a platform fact event in the same transaction.",
    category: "AuditInvariant",
    enforcementPoint: "RuntimeTruthRepository.transition",
    testRef: "tests/unit/platform/state-evidence/truth/runtime-truth-repository.test.ts",
    failureBehavior: "reject mutation and rollback event/audit append",
    owner: "Runtime",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-RUN-001",
    statement: "HarnessRuntime is the only execution entry and P4 must reject bypass execution.",
    category: "RuntimeInvariant",
    enforcementPoint: "RuntimeEntryGuard",
    testRef: "tests/unit/platform/orchestration/harness/runtime/runtime-entry-guard.test.ts",
    failureBehavior: "reject bypass dispatch",
    owner: "Runtime",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-GRAPH-001",
    statement: "The canonical P3 to P4 execution contract is PlanGraphBundle.",
    category: "RuntimeInvariant",
    enforcementPoint: "PlanGraphHarnessRuntime",
    testRef: "tests/unit/platform/orchestration/harness/runtime/plan-graph-harness-runtime.test.ts",
    failureBehavior: "reject non-graph execution contract",
    owner: "Orchestration",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-BUDGET-001",
    statement: "Budget reservation must precede LLM, tool, side-effect, and evaluation cost.",
    category: "PolicyInvariant",
    enforcementPoint: "BudgetAllocator.reserve",
    testRef: "tests/unit/platform/execution/budget-allocator.test.ts",
    failureBehavior: "fail closed and reject execution",
    owner: "Finance Platform",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-REPLAY-001",
    statement: "Replay and simulation must never produce real external side effects.",
    category: "SecurityInvariant",
    enforcementPoint: "EventRegistry.replayBehavior",
    testRef: "tests/unit/platform/state-evidence/events/event-registry.test.ts",
    failureBehavior: "abort replay and emit incident",
    owner: "Evidence",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-SIDEEFFECT-001",
    statement: "Ambiguous side effects must enter reconciliation and cannot be treated as success.",
    category: "RuntimeInvariant",
    enforcementPoint: "SideEffectManager",
    testRef: "tests/unit/platform/execution/side-effect-manager.test.ts",
    failureBehavior: "enter reconciliation or manual review",
    owner: "Execution",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-POLICY-001",
    statement: "Undefined or unproven capability must converge to deny, degrade, require approval, supervised, no-write, no-external-call, or manual-only.",
    category: "SecurityInvariant",
    enforcementPoint: "PolicyEngine and RuntimeStateMachine policy guard",
    testRef: "tests/unit/platform/execution/runtime-state-machine.test.ts",
    failureBehavior: "deny or require approval",
    owner: "Security",
    phase: "MVP",
    nonOverridable: true,
  },
  {
    invariantId: "INV-DOMAIN-001",
    statement: "High and critical domains must declare explicit human accountability and deterministic hot-path boundaries.",
    category: "DomainInvariant",
    enforcementPoint: "DomainRiskProfile and domain-spec gate",
    testRef: "tests/invariants/domain-spec-coverage.test.ts",
    failureBehavior: "block domain release",
    owner: "Domain Platform",
    phase: "Hardening",
    nonOverridable: false,
  },
  {
    invariantId: "INV-RISK-001",
    statement: "TrustScore must not reduce inherent domain risk.",
    category: "RiskInvariant",
    enforcementPoint: "RiskEngine",
    testRef: "tests/invariants/architecture-invariant-registry.test.ts",
    failureBehavior: "ignore trust downgrade and audit",
    owner: "Risk",
    phase: "Hardening",
    nonOverridable: true,
  },
]);

export const NON_OVERRIDABLE_INVARIANT_IDS: readonly string[] = Object.freeze(
  ARCHITECTURE_INVARIANTS.filter((invariant) => invariant.nonOverridable).map((invariant) => invariant.invariantId),
);

export class ArchitectureInvariantRegistry {
  public list(): readonly ArchitectureInvariant[] {
    return ARCHITECTURE_INVARIANTS;
  }

  public resolve(invariantId: string): ArchitectureInvariant {
    const invariant = ARCHITECTURE_INVARIANTS.find((item) => item.invariantId === invariantId);
    if (invariant == null) {
      throw new Error(`Unknown architecture invariant: ${invariantId}`);
    }
    return invariant;
  }

  public assertReleaseGateReady(): void {
    for (const invariant of ARCHITECTURE_INVARIANTS) {
      assertRequiredField(invariant.invariantId, "enforcementPoint", invariant.enforcementPoint);
      assertRequiredField(invariant.invariantId, "testRef", invariant.testRef);
      assertRequiredField(invariant.invariantId, "failureBehavior", invariant.failureBehavior);
      assertRequiredField(invariant.invariantId, "owner", invariant.owner);
      assertRequiredField(invariant.invariantId, "phase", invariant.phase);
    }
  }
}

export class NonOverridableInvariantRegistry {
  public list(): readonly ArchitectureInvariant[] {
    return ARCHITECTURE_INVARIANTS.filter((invariant) => invariant.nonOverridable);
  }

  public canOverride(invariantId: string): boolean {
    const invariant = new ArchitectureInvariantRegistry().resolve(invariantId);
    return !invariant.nonOverridable;
  }

  public assertCanOverride(invariantId: string): void {
    if (!this.canOverride(invariantId)) {
      throw new Error(`Architecture invariant is non-overridable: ${invariantId}`);
    }
  }
}

export function listArchitectureInvariants(): readonly ArchitectureInvariant[] {
  return new ArchitectureInvariantRegistry().list();
}

export function listNonOverridableInvariants(): readonly ArchitectureInvariant[] {
  return new NonOverridableInvariantRegistry().list();
}

function assertRequiredField(invariantId: string, fieldName: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Architecture invariant ${invariantId} is missing ${fieldName}`);
  }
}
