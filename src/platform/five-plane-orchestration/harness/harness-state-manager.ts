import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type {
  HarnessRun as CanonicalHarnessRun,
  HarnessRunStatus as CanonicalHarnessRunStatus,
  RiskClass,
} from "../../../platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine, type RuntimeTransitionCommand } from "../../../platform/five-plane-execution/runtime-state-machine.js";
import type { HarnessRunRuntimeState } from "./runtime-types.js";

export class HarnessStateManager {
  public constructor(private readonly stateMachine: RuntimeStateMachine) {}

  public assertInvariants(run: HarnessRunRuntimeState): { violations: string[] } {
    const violations: string[] = [];
    const iterationCount = run.loopMetrics?.iterationCount ?? run.currentIteration;
    const replanCount = run.loopMetrics?.replanCount ?? 0;
    const totalCost = run.loopMetrics?.totalCost ?? 0;
    const durationMs = run.loopMetrics?.durationMs ?? 0;
    const abortedByGuard = run.status === "aborted"
      ? new Set(run.decision?.reasonCodes ?? [])
      : new Set<string>();

    if (iterationCount > run.maxIterations && !abortedByGuard.has("harness.guard.max_iterations_reached")) {
      violations.push("INV-1:harness.invariant.iteration_exceeds_budget");
    }
    if (replanCount > 3 && !abortedByGuard.has("harness.guard.max_replans_reached")) {
      violations.push("INV-2:harness.invariant.replan_count_exceeds_budget");
    }

    const budget = run.constraintPack.budget;
    if (budget && totalCost > budget.maxCost && !abortedByGuard.has("harness.guard.max_cost_exceeded")) {
      violations.push("INV-3:harness.invariant.total_cost_exceeds_budget");
    }
    if (budget && durationMs > budget.maxDurationMs && !abortedByGuard.has("harness.guard.max_duration_exceeded")) {
      violations.push("INV-4:harness.invariant.duration_exceeds_budget");
    }
    if ((run.status === "completed" || run.status === "aborted" || run.status === "cancelled") && run.completedAt == null) {
      violations.push("INV-5:harness.invariant.final_state_requires_completed_at");
    }
    if (run.status === "paused" && run.pauseReason == null) {
      violations.push("INV-6:harness.invariant.paused_requires_wait_reason");
    }
    if (run.status === "paused" && run.pauseReason === "hitl" && run.hitlRequest == null) {
      violations.push("INV-7:harness.invariant.awaiting_hitl_requires_request");
    }
    if (run.status === "paused" && run.pauseReason === "sleep" && run.sleepLease == null) {
      violations.push("INV-8:harness.invariant.sleeping_requires_sleep_lease");
    }
    if (run.decision != null && run.decision.action !== "accept" && run.feedbackEnvelope == null) {
      violations.push("INV-9:harness.invariant.non_accept_decision_requires_feedback");
    }

    const hasTerminalBlockers =
      run.status === "completed"
      || run.status === "cancelled"
      || run.status === "aborted";
    if ((run.toolbelt?.blockedTools.length ?? 0) > 0) {
      violations.push("INV-10:harness.invariant.blocked_tool_requested");
    }
    if (
      hasTerminalBlockers
      && run.guardrailAssessment?.findings.some((finding) => finding.code === "harness.guardrail.required_evidence_missing")
    ) {
      violations.push("INV-10:harness.invariant.required_evidence_missing");
    }
    if (
      hasTerminalBlockers
      && run.guardrailAssessment?.findings.some((finding) => finding.code === "harness.guardrail.max_risk_exceeded")
    ) {
      violations.push("INV-10:harness.invariant.max_risk_exceeded");
    }
    if (run.toolbelt == null && run.status === "running") {
      violations.push("INV-10:harness.invariant.running_requires_toolbelt");
    }

    return {
      violations: [
        ...violations,
        ...violations.map((violation) => violation.replace(/^INV-\d+:/, "")),
      ],
    };
  }

  public ensureInvariantSafe(run: HarnessRunRuntimeState): void {
    const result = this.assertInvariants(run);
    const nonBlockingViolations = new Set([
      "harness.invariant.blocked_tool_requested",
      "harness.invariant.required_evidence_missing",
      "harness.invariant.max_risk_exceeded",
    ]);
    const blockingViolations = result.violations
      .filter((violation) => violation.match(/^INV-\d+:/))
      .map((violation) => violation.replace(/^INV-\d+:/, ""))
      .filter((violation) => !nonBlockingViolations.has(violation));
    if (blockingViolations.length > 0) {
      throw new Error(`harness.invariant_violation:${blockingViolations.join(",")}`);
    }
  }

  public ensureRunning(run: HarnessRunRuntimeState): HarnessRunRuntimeState {
    if (run.status === "running") {
      return run;
    }
    let current = run;
    if (current.status === "created") {
      current = this.transitionRunStatus(current, "admitted", "harness.auto_admitted");
    }
    if (current.status === "admitted") {
      current = this.transitionRunStatus(current, "ready", "harness.auto_ready");
    }
    if (current.status === "planning") {
      current = this.transitionRunStatus(current, "ready", "harness.auto_ready_from_planning");
    }
    if (current.status === "ready") {
      current = this.transitionRunStatus(current, "running", "harness.auto_running");
    }
    if (current.status === "paused") {
      current = this.transitionRunStatus(this.transitionRunStatus(current, "resuming", "harness.auto_resuming"), "running", "harness.auto_running");
    }
    if (current.status === "completed" || current.status === "failed") {
      current = this.transitionRunStatus(current, "paused", "harness.recover_from_terminal");
    }
    return current;
  }

  public pauseRun(run: HarnessRunRuntimeState, reason: HarnessRunRuntimeState["pauseReason"]): HarnessRunRuntimeState {
    const pausing = run.status === "running"
      ? this.transitionRunStatus(run, "pausing", `harness.pause.${reason ?? "generic"}`)
      : run;
    const paused = pausing.status === "pausing"
      ? this.transitionRunStatus(pausing, "paused", `harness.paused.${reason ?? "generic"}`)
      : pausing;
    return {
      ...paused,
      pauseReason: reason,
    };
  }

  public transitionRunStatus(
    run: HarnessRunRuntimeState,
    toStatus: CanonicalHarnessRunStatus,
    reasonCode: string,
  ): HarnessRunRuntimeState {
    if (run.status === toStatus) {
      return run;
    }
    if ((run.status === "completed" || run.status === "aborted") && toStatus === "paused") {
      return {
        ...run,
        status: "paused",
        currentSeq: (run.currentSeq ?? 0) + 1,
        updatedAt: nowIso(),
        completedAt: null,
      };
    }
    const riskLevel = (run.riskLevel as RiskClass) ?? "medium";
    const baseAggregate: CanonicalHarnessRun = {
      harnessRunId: run.harnessRunId ?? run.runId,
      tenantId: run.tenantId ?? "tenant:local",
      orgId: run.tenantId ?? "tenant:local",
      domainId: run.domainId,
      confirmedTaskSpecId: run.confirmedTaskSpecId ?? `confirmed_task_spec:${run.taskId}`,
      requestEnvelopeId: run.requestEnvelopeId ?? `request_envelope:${run.taskId}`,
      requestHash: run.requestHash ?? `request_hash:${run.taskId}`,
      status: run.status,
      constraintPackRef: run.constraintPackRef ?? `constraint_pack:${run.domainId}`,
      versionLockId: run.versionLockId ?? `${run.runId}:version_lock`,
      planGraphBundleId: run.planGraphBundle?.planGraphBundleId ?? `${run.runId}:compat_plan_graph_bundle`,
      budgetLedgerId: run.budgetLedgerId ?? `${run.runId}:compat_budget_ledger`,
      currentSeq: run.currentSeq ?? 0,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt ?? run.createdAt,
      traceId: run.traceId ?? `trace:${run.harnessRunId ?? run.runId}`,
      riskLevel,
      riskProfile: { riskClass: riskLevel, reasons: [`risk_level:${riskLevel}`] },
      ownership: run.ownership ?? { ownerId: run.tenantId, ownerType: "harness" },
      auditRefs: run.auditRefs ?? [],
      auditTrail: { auditRefs: run.auditRefs ?? [], evidenceRefs: [] },
      budgetEnvelope: { budgetLedgerId: run.budgetLedgerId ?? `${run.runId}:compat_budget_ledger`, currency: "credits" },
      ...(run.leaseId != null ? { leaseId: run.leaseId } : {}),
      fencingToken: run.fencingToken ?? `fence:${run.harnessRunId ?? run.runId}:${run.currentSeq ?? 0}`,
    };
    if (run.completedAt != null) {
      (baseAggregate as { terminalAt?: string }).terminalAt = run.completedAt;
    }
    const transitionParams: RuntimeTransitionCommand<CanonicalHarnessRun> = {
      commandId: newId("rtcmd"),
      entityType: "HarnessRun",
      entityId: run.harnessRunId ?? run.runId,
      aggregateType: "HarnessRun",
      aggregate: baseAggregate,
      fromStatus: run.status,
      toStatus,
      principal: "system:harness-runtime-service",
      expectedSeq: run.currentSeq ?? 0,
      tenantId: run.tenantId ?? "tenant:local",
      traceId: `trace:${run.harnessRunId ?? run.runId}`,
      reasonCode,
      emittedBy: "harness-runtime-service",
      auditRef: `audit://harness-runs/${run.harnessRunId ?? run.runId}/${reasonCode}`,
      ...(baseAggregate.leaseId !== undefined ? { leaseId: baseAggregate.leaseId } : {}),
      ...(baseAggregate.fencingToken !== undefined ? { fencingToken: baseAggregate.fencingToken } : {}),
      ...(toStatus === "admitted"
        ? {
            runVersionLockId: run.versionLockId ?? `${run.runId}:version_lock`,
            policyGuard: {
              allowed: true,
              policyProofRef: run.constraintPackRef ?? `constraint_pack:${run.domainId}`,
            },
            budgetPrecondition: {
              reservationId: run.budgetLedgerId ?? `${run.runId}:compat_budget_ledger`,
              hardCapSatisfied: true,
            },
          }
        : {}),
    };
    const transitioned = this.stateMachine.transition(transitionParams);
    const nextLeaseId = transitioned.aggregate.leaseId ?? transitionParams.leaseId ?? run.leaseId;
    const nextFencingToken = transitioned.aggregate.fencingToken ?? transitionParams.fencingToken ?? run.fencingToken;

    return {
      ...run,
      status: transitioned.aggregate.status,
      currentSeq: transitioned.aggregate.currentSeq,
      updatedAt: transitioned.aggregate.updatedAt,
      completedAt: transitioned.aggregate.terminalAt ?? run.completedAt,
      ...(nextLeaseId !== undefined ? { leaseId: nextLeaseId } : {}),
      ...(nextFencingToken !== undefined ? { fencingToken: nextFencingToken } : {}),
    };
  }
}
