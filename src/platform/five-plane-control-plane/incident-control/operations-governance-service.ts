/**
 * Operations Governance Service
 *
 * Provides comprehensive governance reporting for operations including SLO
 * evaluation, runbook recommendations, oncall policy information, and
 * incident packaging for automated alerting and human review.
 *
 * This service is the core of the operations governance subsystem, aggregating
 * metrics, health, and diagnostics data into actionable governance reports.
 */

import { ArtifactStore, type ArtifactStoreOptions } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import {
  buildIncidentTimelineMarkdown,
  type IncidentTimelineReport,
  type DiagnosticWarningSeverity,
  DiagnosticsService,
} from "../../shared/observability/diagnostics-service.js";
import { MetricsService, type RuntimeMetricsSummary } from "../../shared/observability/metrics-service.js";
import { DoctorService, type DoctorReport } from "./doctor-service.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactRef, EnvironmentName } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  diagnosticSeverityToUnifiedSeverity,
  type UnifiedSeverity,
} from "../../contracts/types/index.js";

export type OperationsSloKey =
  | "task_success_rate"
  | "task_start_latency"
  | "approval_delivery_availability"
  | "recovery_success_rate"
  | "tier1_event_delivery_latency"
  | "cost_accounting_accuracy";

export type OperationsSloStatus = "pass" | "warning" | "fail" | "insufficient_data";

export interface OperationsSloReport {
  key: OperationsSloKey;
  displayName: string;
  objective: string;
  unit: "percent" | "milliseconds";
  source: string;
  actualValue: number | null;
  thresholdValue: number;
  comparator: ">=" | "<=";
  status: OperationsSloStatus;
  errorBudgetRemainingPct: number | null;
  notes: string[];
}

export type RunbookSeverity = "P0" | "P1" | "P2" | "P3";

export interface RunbookDefinition {
  runbookId:
    | "worker_mass_disconnect"
    | "provider_429_or_5xx_spike"
    | "queue_backlog_breach"
    | "approval_channel_unavailable"
    | "cost_spike_containment"
    | "database_lock_contention"
    | "stale_lease_repair"
    | "secret_rotation_failure"
    | "oapeflir_loop_stalled"
    | "rollout_blocked_or_rollback";
  title: string;
  severity: RunbookSeverity;
  summary: string;
  ownerRole: string;
  documentRefs: string[];
  commands: string[];
}

export interface OncallContact {
  role: string;
  escalationAfterMinutes: number;
  responsibilities: string[];
}

export interface OperationsOncallPolicy {
  policyId: string;
  primaryRole: string;
  secondaryRole: string;
  contacts: OncallContact[];
  communicationChannels: string[];
  handoverRequirements: string[];
}

export interface OperationsIncidentPackage {
  incidentId: string;
  taskId: string;
  severity: RunbookSeverity;
  unifiedSeverity: UnifiedSeverity;
  candidateRootCauses: string[];
  recommendedRunbookIds: RunbookDefinition["runbookId"][];
  recommendedCommands: string[];
  timeline: IncidentTimelineReport;
  markdown: string;
}

export interface OperationsGovernanceReport {
  reportId: string;
  generatedAt: string;
  environment: EnvironmentName;
  summary: {
    overallStatus: "pass" | "warning" | "fail";
    failingSloCount: number;
    warningSloCount: number;
    runbookCount: number;
    oncallReady: boolean;
    incidentConsoleReady: boolean;
  };
  slos: OperationsSloReport[];
  runbooks: RunbookDefinition[];
  oncallPolicy: OperationsOncallPolicy;
  metrics: RuntimeMetricsSummary;
  doctor: Pick<DoctorReport, "status" | "selfCheckSummary" | "eventBacklogSummary" | "workerSummary">;
  incident: OperationsIncidentPackage | null;
}

export interface OperationsGovernanceBuildInput {
  environment: EnvironmentName;
  generatedAt?: string;
  taskId?: string;
}

export interface OperationsGovernanceExportResult {
  report: OperationsGovernanceReport;
  jsonArtifact: ArtifactRef;
  markdownArtifact: ArtifactRef;
}

/**
 * Registry of predefined runbooks for common operational scenarios.
 * Each runbook includes severity, owner role, documentation references,
 * and recommended mitigation commands.
 */
export const OPERATIONS_RUNBOOK_CATALOG: readonly RunbookDefinition[] = [
  {
    runbookId: "worker_mass_disconnect",
    title: "Worker Mass Disconnect",
    severity: "P0",
    summary: "Handle worker fleet wide disconnects or coordinator-to-worker reachability loss.",
    ownerRole: "runtime_reliability_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md",
    ],
    commands: ["npm run doctor", "npm run worker-handshake:stable"],
  },
  {
    runbookId: "provider_429_or_5xx_spike",
    title: "Provider 429 Or 5xx Spike",
    severity: "P1",
    summary: "Mitigate provider outage or throttling via cooldown, fallback, and admission tightening.",
    ownerRole: "runtime_reliability_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/tool_and_provider_execution_contract.md",
    ],
    commands: ["npm run doctor", "AA_VALIDATION_ITERATIONS=2 npm run validate:stable"],
  },
  {
    runbookId: "queue_backlog_breach",
    title: "Queue Backlog Breach",
    severity: "P1",
    summary: "Drain queue backlog, validate replay safety, and tighten admission control.",
    ownerRole: "runtime_reliability_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/debug_inspect_health_backpressure_contract.md",
    ],
    commands: ["npm run doctor", "npm run queue:stable", "npm run dispatch-reconcile:stable"],
  },
  {
    runbookId: "approval_channel_unavailable",
    title: "Approval Channel Unavailable",
    severity: "P1",
    summary: "Investigate approval delivery failures and preserve blocked tasks without bypassing policy.",
    ownerRole: "ops_control_plane_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/approval_and_hitl_contract.md",
    ],
    commands: ["npm run doctor", "npm run inspect"],
  },
  {
    runbookId: "cost_spike_containment",
    title: "Cost Spike Containment",
    severity: "P2",
    summary: "Contain rapid budget drift, isolate offending tasks, and tighten cost guards.",
    ownerRole: "finance_ops_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/cost_and_budget_contract.md",
    ],
    commands: ["npm run doctor", "npm run billing"],
  },
  {
    runbookId: "database_lock_contention",
    title: "Database Lock Contention",
    severity: "P0",
    summary: "Handle authoritative SQLite contention, write stall, and fail-closed recovery.",
    ownerRole: "runtime_reliability_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/storage_schema_contract.md",
    ],
    commands: ["npm run doctor", "npm run db-writability:stable", "npm run migration:stable"],
  },
  {
    runbookId: "stale_lease_repair",
    title: "Stale Lease Repair",
    severity: "P1",
    summary: "Repair stale execution ownership, lease fencing, and replay blocked dispatch claims.",
    ownerRole: "runtime_reliability_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/task_lease_and_fencing_contract.md",
    ],
    commands: ["npm run doctor", "npm run lease:stable", "npm run repair"],
  },
  {
    runbookId: "secret_rotation_failure",
    title: "Secret Rotation Failure",
    severity: "P1",
    summary: "Recover from provider or platform credential rotation drift without leaking secrets.",
    ownerRole: "security_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/enterprise_secret_management_contract.md",
    ],
    commands: ["npm run doctor", "npm run model-routing"],
  },
  {
    runbookId: "oapeflir_loop_stalled",
    title: "OAPEFLIR Loop Stalled",
    severity: "P1",
    summary: "Recover a stalled observe-assess-plan-execute-feedback-learn-improve-release loop without bypassing governance gates.",
    ownerRole: "ops_control_plane_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/oapeflir_loop_contract.md",
    ],
    commands: ["npm run inspect", "npm run dispatch-execution", "npm run doctor"],
  },
  {
    runbookId: "rollout_blocked_or_rollback",
    title: "Rollout Blocked Or Rollback",
    severity: "P0",
    summary: "Triage rollout freezes, blocked advances, and rollback requirements while preserving release audit lineage.",
    ownerRole: "release_manager_oncall",
    documentRefs: [
      "docs_zh/contracts/slo_alerting_and_runbook_contract.md",
      "docs_zh/contracts/release_pipeline_contract.md",
    ],
    commands: ["npm run inspect", "npm run doctor", "npm run dispatch-reconcile:stable"],
  },
] as const;

/**
 * Default oncall policy for operations governance.
 * Defines primary and secondary roles, escalation paths, and handover requirements.
 */
const ONCALL_POLICY: OperationsOncallPolicy = {
  policyId: "ops-governance-default",
  primaryRole: "runtime_reliability_oncall",
  secondaryRole: "release_manager_oncall",
  contacts: [
    {
      role: "runtime_reliability_oncall",
      escalationAfterMinutes: 0,
      responsibilities: ["triage runtime failures", "execute recovery and repair playbooks"],
    },
    {
      role: "release_manager_oncall",
      escalationAfterMinutes: 15,
      responsibilities: ["coordinate rollback, release freeze, and maintenance handover"],
    },
    {
      role: "security_oncall",
      escalationAfterMinutes: 30,
      responsibilities: ["handle secret rotation failure and governance tamper findings"],
    },
  ],
  communicationChannels: ["incident_console", "ops_gateway", "oncall_notifications"],
  handoverRequirements: [
    "record active incident id, failing SLOs, and executed mitigation commands",
    "attach diagnostics incident package and doctor summary to the handover note",
    "capture whether rollback, repair, or admission tightening has already been applied",
  ],
};

/**
 * Computes a ratio as a percentage, handling division by zero gracefully.
 */
function ratioPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

/**
 * Computes a percentile value from an array of numbers.
 * Returns null if the array is empty.
 */
function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return Number(sorted[index]!.toFixed(2));
}

/**
 * Computes the remaining error budget for an SLO.
 * Error budget represents how much margin remains before the SLO would be breached.
 */
function computeErrorBudgetRemaining(actualValue: number | null, thresholdValue: number, comparator: ">=" | "<="): number | null {
  if (actualValue == null) {
    return null;
  }
  if (comparator === ">=") {
    return Number(Math.max(0, actualValue - thresholdValue).toFixed(2));
  }
  return Number(Math.max(0, thresholdValue - actualValue).toFixed(2));
}

/**
 * Evaluates a single SLO against its target and determines its status.
 * Status can be pass, warning (within 10% of threshold), or fail.
 */
function evaluateSlo(
  key: OperationsSloKey,
  displayName: string,
  objective: string,
  unit: "percent" | "milliseconds",
  source: string,
  actualValue: number | null,
  thresholdValue: number,
  comparator: ">=" | "<=",
  notes: string[] = [],
): OperationsSloReport {
  let status: OperationsSloStatus;
  if (actualValue == null) {
    status = "insufficient_data";
  } else if (comparator === ">=") {
    status = actualValue >= thresholdValue ? "pass" : actualValue >= thresholdValue * 0.9 ? "warning" : "fail";
  } else {
    status = actualValue <= thresholdValue ? "pass" : actualValue <= thresholdValue * 1.2 ? "warning" : "fail";
  }

  return {
    key,
    displayName,
    objective,
    unit,
    source,
    actualValue,
    thresholdValue,
    comparator,
    status,
    errorBudgetRemainingPct: computeErrorBudgetRemaining(actualValue, thresholdValue, comparator),
    notes,
  };
}

/**
 * Maps diagnostic warning severity to runbook severity.
 * Used when building incident packages from diagnostics data.
 */
function severityRank(severity: DiagnosticWarningSeverity | RunbookSeverity): number {
  switch (severity) {
    case "critical":
    case "P0":
      return 4;
    case "warning":
    case "P1":
      return 3;
    case "P2":
      return 2;
    case "info":
    case "P3":
    default:
      return 1;
  }
}

/**
 * Converts a diagnostic warning severity to a runbook severity level.
 */
function mapIncidentSeverity(value: DiagnosticWarningSeverity): RunbookSeverity {
  switch (value) {
    case "critical":
      return "P0";
    case "warning":
      return "P1";
    case "info":
    default:
      return "P2";
  }
}

function mapDiagnosticUnifiedSeverity(value: DiagnosticWarningSeverity): UnifiedSeverity {
  return diagnosticSeverityToUnifiedSeverity(value);
}

/**
 * Deduplicates an array while preserving order.
 */
function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * Builds a markdown representation of an operations governance report.
 * Used for human-readable export and incident documentation.
 */
function buildMarkdownReport(report: OperationsGovernanceReport): string {
  const lines = [
    "# Operations Governance Report",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Generated At: \`${report.generatedAt}\``,
    `- Environment: \`${report.environment}\``,
    `- Overall Status: \`${report.summary.overallStatus}\``,
    "",
    "## SLOs",
    "",
    ...report.slos.map((slo) =>
      `- \`${slo.key}\`: status=\`${slo.status}\`, actual=\`${slo.actualValue ?? "n/a"}\`, objective=\`${slo.objective}\``,
    ),
    "",
    "## Runbooks",
    "",
    ...report.runbooks.map((runbook) => `- \`${runbook.runbookId}\` (${runbook.severity}) - ${runbook.title}`),
    "",
    "## Oncall",
    "",
    `- Primary: \`${report.oncallPolicy.primaryRole}\``,
    `- Secondary: \`${report.oncallPolicy.secondaryRole}\``,
    ...report.oncallPolicy.contacts.map(
      (contact) => `- ${contact.role}: escalate after ${contact.escalationAfterMinutes}m`,
    ),
  ];

  if (report.incident) {
    lines.push(
      "",
      "## Incident Package",
      "",
      `- Incident ID: \`${report.incident.incidentId}\``,
      `- Task ID: \`${report.incident.taskId}\``,
      `- Severity: \`${report.incident.severity}\``,
      `- Recommended Runbooks: ${report.incident.recommendedRunbookIds.map((value) => `\`${value}\``).join(", ") || "none"}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export interface OperationsGovernanceServiceOptions {
  artifactStoreOptions?: ArtifactStoreOptions;
}

/**
 * OperationsGovernanceService aggregates metrics, health, and diagnostics data
 * into comprehensive governance reports for operations teams. It evaluates SLOs,
 * recommends runbooks, and packages incident information for efficient
 * incident response and shift handoffs.
 */
export class OperationsGovernanceService {
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly metricsService: MetricsService,
    private readonly doctorService: DoctorService,
    private readonly diagnosticsService: DiagnosticsService,
    options: OperationsGovernanceServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
  }

  /**
   * Builds a comprehensive operations governance report including SLO status,
   * runbook recommendations, oncall policy, and optionally an incident package.
   */
  public buildReport(input: OperationsGovernanceBuildInput): OperationsGovernanceReport {
    const generatedAt = input.generatedAt ?? nowIso();
    const metrics = this.metricsService.buildSummary(generatedAt);
    const doctor = this.doctorService.run();
    const slos = this.buildSlos(metrics, doctor);
    const incident = input.taskId ? this.buildIncidentPackage(input.taskId) : null;
    const failingSloCount = slos.filter((item) => item.status === "fail").length;
    const warningSloCount = slos.filter((item) => item.status === "warning").length;

    return {
      reportId: newId("ops_governance_report"),
      generatedAt,
      environment: input.environment,
      summary: {
        overallStatus: failingSloCount > 0 ? "fail" : warningSloCount > 0 ? "warning" : "pass",
        failingSloCount,
        warningSloCount,
        runbookCount: OPERATIONS_RUNBOOK_CATALOG.length,
        oncallReady: ONCALL_POLICY.contacts.length >= 2,
        incidentConsoleReady: incident != null,
      },
      slos,
      runbooks: [...OPERATIONS_RUNBOOK_CATALOG],
      oncallPolicy: ONCALL_POLICY,
      metrics,
      doctor: {
        status: doctor.status,
        selfCheckSummary: doctor.selfCheckSummary,
        eventBacklogSummary: doctor.eventBacklogSummary,
        workerSummary: doctor.workerSummary,
      },
      incident,
    };
  }

  /**
   * Exports the governance report to JSON and markdown artifacts.
   */
  public exportReport(input: OperationsGovernanceBuildInput): OperationsGovernanceExportResult {
    const report = this.buildReport(input);
    const taskId = input.taskId ?? "ops-governance";
    const markdown = buildMarkdownReport(report);

    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "ops_governance_report",
      fileName: `ops-governance-${report.environment}.json`,
      content: report,
      lineage: {
        environment: report.environment,
        reportId: report.reportId,
      },
    }).ref;
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId,
      executionId: null,
      stepId: null,
      kind: "ops_governance_markdown",
      fileName: `ops-governance-${report.environment}.md`,
      mimeType: "text/markdown",
      content: markdown,
      lineage: {
        environment: report.environment,
        reportId: report.reportId,
      },
    }).ref;

    return {
      report,
      jsonArtifact,
      markdownArtifact,
    };
  }

  /**
   * Builds SLO reports by evaluating metrics against defined thresholds.
   * Each SLO is evaluated with pass/warning/fail/insufficient_data status.
   */
  private buildSlos(metrics: RuntimeMetricsSummary, doctor: DoctorReport): OperationsSloReport[] {
    const taskStartLatencies = this.collectTaskStartLatenciesMs();
    const taskStartLatencyP95 = percentile(taskStartLatencies, 95);
    const approvalAvailability =
      metrics.approvalMetrics.total === 0
        ? 100
        : ratioPct(metrics.approvalMetrics.resolvedCount, metrics.approvalMetrics.total);
    const tier1LatencyMs =
      doctor.eventBacklogSummary.pendingTier1Acks > 0 && doctor.eventBacklogSummary.oldestWaitSeconds != null
        ? Number((doctor.eventBacklogSummary.oldestWaitSeconds * 1000).toFixed(2))
        : 0;
    const costAccuracy = this.computeCostAccountingAccuracyPct();

    return [
      evaluateSlo(
        "task_success_rate",
        "Task Success Rate",
        ">= 99%",
        "percent",
        "metrics.taskMetrics.successRate",
        Number((metrics.taskMetrics.successRate * 100).toFixed(2)),
        99,
        ">=",
      ),
      evaluateSlo(
        "task_start_latency",
        "Task Start Latency (P95)",
        "<= 30000ms",
        "milliseconds",
        "sqlite.executions.started_at - tasks.created_at",
        taskStartLatencyP95,
        30_000,
        "<=",
        taskStartLatencies.length === 0 ? ["no started executions available"] : [],
      ),
      evaluateSlo(
        "approval_delivery_availability",
        "Approval Delivery Availability",
        ">= 99%",
        "percent",
        "metrics.approvalMetrics.resolvedCount / total",
        approvalAvailability,
        99,
        ">=",
      ),
      evaluateSlo(
        "recovery_success_rate",
        "Recovery Success Rate",
        ">= 95%",
        "percent",
        "metrics.recoveryMetrics.successRate",
        Number((metrics.recoveryMetrics.successRate * 100).toFixed(2)),
        95,
        ">=",
      ),
      evaluateSlo(
        "tier1_event_delivery_latency",
        "Tier 1 Event Delivery Latency",
        "<= 5000ms",
        "milliseconds",
        "doctor.eventBacklogSummary.oldestWaitSeconds",
        tier1LatencyMs,
        5_000,
        "<=",
        doctor.eventBacklogSummary.pendingTier1Acks > 0 ? ["pending tier1 ack backlog exists"] : [],
      ),
      evaluateSlo(
        "cost_accounting_accuracy",
        "Cost Accounting Accuracy",
        "<= 20% drift",
        "percent",
        "sqlite.tasks.estimated_cost_usd vs actual_cost_usd",
        costAccuracy,
        20,
        "<=",
      ),
    ];
  }

  /**
   * Collects task start latencies in milliseconds from the database.
   * Start latency is the time between task creation and execution start.
   */
  private collectTaskStartLatenciesMs(): number[] {
    const rows = this.db.connection
      .prepare(
        `SELECT
           (julianday(e.started_at) - julianday(t.created_at)) * 86400000.0 AS latencyMs
         FROM executions e
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE e.started_at IS NOT NULL`,
      )
      .all() as Array<{ latencyMs: number | null }>;
    return rows
      .map((row) => Number(row.latencyMs ?? Number.NaN))
      .filter((value) => Number.isFinite(value) && value >= 0);
  }

  /**
   * Computes the average cost accounting accuracy as a percentage drift
   * between estimated and actual costs.
   */
  private computeCostAccountingAccuracyPct(): number | null {
    const rows = this.db.connection
      .prepare(
        `SELECT estimated_cost_usd AS estimatedCostUsd, actual_cost_usd AS actualCostUsd
         FROM tasks
         WHERE estimated_cost_usd IS NOT NULL
           AND estimated_cost_usd > 0`,
      )
      .all() as Array<{ estimatedCostUsd: number | null; actualCostUsd: number | null }>;

    const drifts = rows
      .map((row) => {
        if (row.estimatedCostUsd == null || row.estimatedCostUsd <= 0 || row.actualCostUsd == null) {
          return Number.NaN;
        }
        return Math.abs(((row.actualCostUsd - row.estimatedCostUsd) / row.estimatedCostUsd) * 100);
      })
      .filter((value) => Number.isFinite(value));

    if (drifts.length === 0) {
      return null;
    }
    const total = drifts.reduce((sum, value) => sum + value, 0);
    return Number((total / drifts.length).toFixed(2));
  }

  /**
   * Builds an incident package for a specific task, including the incident
   * timeline, candidate root causes, and recommended runbooks and commands.
   */
  private buildIncidentPackage(taskId: string): OperationsIncidentPackage {
    const timeline = this.diagnosticsService.buildIncidentTimelineReport(taskId);
    const severity = mapIncidentSeverity(timeline.summary.highestSeverity);
    const recommendedRunbooks = this.recommendRunbooks(timeline);
    const recommendedCommands = dedupe(
      recommendedRunbooks.flatMap((runbookId) => OPERATIONS_RUNBOOK_CATALOG.find((item) => item.runbookId === runbookId)?.commands ?? []),
    );

    return {
      incidentId: newId("incident"),
      taskId,
      severity,
      unifiedSeverity: mapDiagnosticUnifiedSeverity(timeline.summary.highestSeverity),
      candidateRootCauses: [...timeline.candidateRootCauses],
      recommendedRunbookIds: recommendedRunbooks,
      recommendedCommands,
      markdown: buildIncidentTimelineMarkdown(timeline),
      timeline,
    };
  }

  /**
   * Recommends runbooks based on the incident timeline's root causes
   * and diagnostic entries. Uses keyword matching against known patterns.
   */
  private recommendRunbooks(timeline: IncidentTimelineReport): RunbookDefinition["runbookId"][] {
    const matches = new Set<RunbookDefinition["runbookId"]>();
    const rootCauseText = timeline.candidateRootCauses.join(" ").toLowerCase();
    const titlesAndSummaries = timeline.entries
      .map((entry) => `${entry.title} ${entry.summary}`.toLowerCase())
      .join(" ");

    // Match based on keywords in root causes and diagnostic entries
    if (rootCauseText.includes("provider") || titlesAndSummaries.includes("provider") || titlesAndSummaries.includes("429")) {
      matches.add("provider_429_or_5xx_spike");
    }
    if (rootCauseText.includes("approval") || titlesAndSummaries.includes("approval")) {
      matches.add("approval_channel_unavailable");
    }
    if (rootCauseText.includes("lease") || rootCauseText.includes("worker") || titlesAndSummaries.includes("lease")) {
      matches.add("stale_lease_repair");
    }
    if (rootCauseText.includes("queue") || titlesAndSummaries.includes("backlog")) {
      matches.add("queue_backlog_breach");
    }
    if (rootCauseText.includes("cost") || titlesAndSummaries.includes("budget")) {
      matches.add("cost_spike_containment");
    }
    if (rootCauseText.includes("database") || rootCauseText.includes("sqlite") || titlesAndSummaries.includes("sql")) {
      matches.add("database_lock_contention");
    }
    if (rootCauseText.includes("secret") || titlesAndSummaries.includes("credential")) {
      matches.add("secret_rotation_failure");
    }
    if (timeline.summary.highestSeverity === "critical" && matches.size === 0) {
      matches.add("worker_mass_disconnect");
    }
    if (matches.size === 0) {
      matches.add("queue_backlog_breach");
    }

    return [...matches];
  }
}
