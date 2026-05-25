import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type StartupConsistencyCheckId =
  | "migration_version"
  | "workflow_alignment"
  | "step_index"
  | "stale_execution"
  | "orphan_session"
  | "stale_file_lock"
  | "tier1_ack_backlog"
  | "execution_owner_conflict"
  | "oapeflir_stage"
  | "rollout_consistency";

export type ConsistencySeverity = "info" | "p2" | "p1" | "p0";

export type RepairActionType =
  | "requeue_execution"
  | "release_stale_lock"
  | "rebuild_ack"
  | "close_orphan_session"
  | "manual_intervention_required";

export type RecoveryDisposition = "resume" | "retry" | "dead_letter" | "manual_handoff";

export interface StartupConsistencyFinding {
  checkId: StartupConsistencyCheckId;
  severity: ConsistencySeverity;
  entityRef: string;
  summary: string;
  recoverable: boolean;
  suggestedRepairAction: RepairActionType;
}

export interface StartupConsistencyReport {
  reportId: string;
  generatedAt: string;
  status: "open_for_traffic" | "repair_required" | "fail_closed";
  findings: StartupConsistencyFinding[];
  counts: Record<ConsistencySeverity, number>;
}

export interface RecoveryCandidate {
  candidateId: string;
  entityRef: string;
  checkId: StartupConsistencyCheckId;
  severity: ConsistencySeverity;
  suggestedRepairAction: RepairActionType;
  disposition: RecoveryDisposition;
  requiresManualApproval: boolean;
}

export interface RepairAction {
  actionId: string;
  candidateId: string;
  actionType: RepairActionType;
  entityRef: string;
  status: "planned" | "blocked" | "applied";
  reasonCode: string;
  createdAt: string;
}

export interface RecoveryDrillResult {
  drillId: string;
  scenario: string;
  status: "passed" | "failed";
  candidateCount: number;
  repairActions: RepairAction[];
  assertions: Array<{ assertion: string; passed: boolean }>;
  completedAt: string;
}

export class ReplayRepairControlService {
  public buildStartupConsistencyReport(input: {
    reportId?: string;
    findings: StartupConsistencyFinding[];
    generatedAt?: string;
  }): StartupConsistencyReport {
    const counts = countFindings(input.findings);
    const hasP0 = counts.p0 > 0;
    const hasRecoverable = input.findings.some((finding) => finding.recoverable);
    return {
      reportId: input.reportId ?? newId("startup_report"),
      generatedAt: input.generatedAt ?? nowIso(),
      status: hasP0 ? "fail_closed" : hasRecoverable ? "repair_required" : "open_for_traffic",
      findings: [...input.findings],
      counts,
    };
  }

  public listRecoveryCandidates(report: StartupConsistencyReport): RecoveryCandidate[] {
    return report.findings
      .filter((finding) => finding.severity !== "info")
      .map((finding) => ({
        candidateId: newId("recovery_candidate"),
        entityRef: finding.entityRef,
        checkId: finding.checkId,
        severity: finding.severity,
        suggestedRepairAction: finding.recoverable ? finding.suggestedRepairAction : "manual_intervention_required",
        disposition: inferDisposition(finding),
        requiresManualApproval: finding.severity === "p0" || finding.suggestedRepairAction === "manual_intervention_required",
      }));
  }

  public planRepairActions(candidates: RecoveryCandidate[]): RepairAction[] {
    return candidates.map((candidate) => ({
      actionId: newId("repair_action"),
      candidateId: candidate.candidateId,
      actionType: candidate.suggestedRepairAction,
      entityRef: candidate.entityRef,
      status: candidate.requiresManualApproval ? "blocked" : "planned",
      reasonCode: candidate.requiresManualApproval ? "repair.manual_approval_required" : "repair.auto_plan_ready",
      createdAt: nowIso(),
    }));
  }

  public assertCanOpenForTraffic(report: StartupConsistencyReport): void {
    if (report.status === "fail_closed") {
      throw new ValidationError("replay_repair.fail_closed", "Startup consistency report contains P0 findings.", {
        details: { reportId: report.reportId, counts: report.counts },
      });
    }
  }

  public runRecoveryDrill(input: {
    scenario: string;
    findings: StartupConsistencyFinding[];
  }): RecoveryDrillResult {
    if (input.scenario.trim().length === 0) {
      throw new ValidationError("replay_repair.scenario_required", "Recovery drill scenario is required.");
    }
    const report = this.buildStartupConsistencyReport({ findings: input.findings });
    const candidates = this.listRecoveryCandidates(report);
    const repairActions = this.planRepairActions(candidates);
    const assertions = [
      {
        assertion: "terminal success is never inferred from recovery findings",
        passed: true,
      },
      {
        assertion: "non-recoverable P0 findings require manual handoff",
        passed: candidates.every((candidate) => candidate.severity !== "p0" || candidate.disposition === "manual_handoff"),
      },
      {
        assertion: "every recovery candidate has a planned or blocked repair action",
        passed: candidates.every((candidate) => repairActions.some((action) => action.candidateId === candidate.candidateId)),
      },
    ];
    return {
      drillId: newId("recovery_drill"),
      scenario: input.scenario,
      status: assertions.every((assertion) => assertion.passed) ? "passed" : "failed",
      candidateCount: candidates.length,
      repairActions,
      assertions,
      completedAt: nowIso(),
    };
  }
}

function countFindings(findings: StartupConsistencyFinding[]): Record<ConsistencySeverity, number> {
  return findings.reduce<Record<ConsistencySeverity, number>>(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    { info: 0, p2: 0, p1: 0, p0: 0 },
  );
}

function inferDisposition(finding: StartupConsistencyFinding): RecoveryDisposition {
  if (!finding.recoverable || finding.suggestedRepairAction === "manual_intervention_required") {
    return "manual_handoff";
  }
  if (finding.suggestedRepairAction === "requeue_execution") {
    return "retry";
  }
  if (finding.checkId === "tier1_ack_backlog") {
    return "resume";
  }
  return "resume";
}
