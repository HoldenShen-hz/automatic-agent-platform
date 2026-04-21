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
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { buildIncidentTimelineMarkdown, } from "../../shared/observability/diagnostics-service.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * Registry of predefined runbooks for common operational scenarios.
 * Each runbook includes severity, owner role, documentation references,
 * and recommended mitigation commands.
 */
const RUNBOOKS = [
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
];
/**
 * Default oncall policy for operations governance.
 * Defines primary and secondary roles, escalation paths, and handover requirements.
 */
const ONCALL_POLICY = {
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
function ratioPct(numerator, denominator) {
    if (denominator <= 0) {
        return null;
    }
    return Number(((numerator / denominator) * 100).toFixed(2));
}
/**
 * Computes a percentile value from an array of numbers.
 * Returns null if the array is empty.
 */
function percentile(values, percentileValue) {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
    return Number(sorted[index].toFixed(2));
}
/**
 * Computes the remaining error budget for an SLO.
 * Error budget represents how much margin remains before the SLO would be breached.
 */
function computeErrorBudgetRemaining(actualValue, thresholdValue, comparator) {
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
function evaluateSlo(key, displayName, objective, unit, source, actualValue, thresholdValue, comparator, notes = []) {
    let status;
    if (actualValue == null) {
        status = "insufficient_data";
    }
    else if (comparator === ">=") {
        status = actualValue >= thresholdValue ? "pass" : actualValue >= thresholdValue * 0.9 ? "warning" : "fail";
    }
    else {
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
function severityRank(severity) {
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
function mapIncidentSeverity(value) {
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
/**
 * Deduplicates an array while preserving order.
 */
function dedupe(values) {
    return [...new Set(values)];
}
/**
 * Builds a markdown representation of an operations governance report.
 * Used for human-readable export and incident documentation.
 */
function buildMarkdownReport(report) {
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
        ...report.slos.map((slo) => `- \`${slo.key}\`: status=\`${slo.status}\`, actual=\`${slo.actualValue ?? "n/a"}\`, objective=\`${slo.objective}\``),
        "",
        "## Runbooks",
        "",
        ...report.runbooks.map((runbook) => `- \`${runbook.runbookId}\` (${runbook.severity}) - ${runbook.title}`),
        "",
        "## Oncall",
        "",
        `- Primary: \`${report.oncallPolicy.primaryRole}\``,
        `- Secondary: \`${report.oncallPolicy.secondaryRole}\``,
        ...report.oncallPolicy.contacts.map((contact) => `- ${contact.role}: escalate after ${contact.escalationAfterMinutes}m`),
    ];
    if (report.incident) {
        lines.push("", "## Incident Package", "", `- Incident ID: \`${report.incident.incidentId}\``, `- Task ID: \`${report.incident.taskId}\``, `- Severity: \`${report.incident.severity}\``, `- Recommended Runbooks: ${report.incident.recommendedRunbookIds.map((value) => `\`${value}\``).join(", ") || "none"}`);
    }
    return `${lines.join("\n")}\n`;
}
/**
 * OperationsGovernanceService aggregates metrics, health, and diagnostics data
 * into comprehensive governance reports for operations teams. It evaluates SLOs,
 * recommends runbooks, and packages incident information for efficient
 * incident response and shift handoffs.
 */
export class OperationsGovernanceService {
    db;
    metricsService;
    doctorService;
    diagnosticsService;
    artifactStore;
    constructor(db, metricsService, doctorService, diagnosticsService, options = {}) {
        this.db = db;
        this.metricsService = metricsService;
        this.doctorService = doctorService;
        this.diagnosticsService = diagnosticsService;
        this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
    }
    /**
     * Builds a comprehensive operations governance report including SLO status,
     * runbook recommendations, oncall policy, and optionally an incident package.
     */
    buildReport(input) {
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
                runbookCount: RUNBOOKS.length,
                oncallReady: ONCALL_POLICY.contacts.length >= 2,
                incidentConsoleReady: incident != null,
            },
            slos,
            runbooks: [...RUNBOOKS],
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
    exportReport(input) {
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
    buildSlos(metrics, doctor) {
        const taskStartLatencies = this.collectTaskStartLatenciesMs();
        const taskStartLatencyP95 = percentile(taskStartLatencies, 95);
        const approvalAvailability = metrics.approvalMetrics.total === 0
            ? 100
            : ratioPct(metrics.approvalMetrics.resolvedCount, metrics.approvalMetrics.total);
        const tier1LatencyMs = doctor.eventBacklogSummary.pendingTier1Acks > 0 && doctor.eventBacklogSummary.oldestWaitSeconds != null
            ? Number((doctor.eventBacklogSummary.oldestWaitSeconds * 1000).toFixed(2))
            : 0;
        const costAccuracy = this.computeCostAccountingAccuracyPct();
        return [
            evaluateSlo("task_success_rate", "Task Success Rate", ">= 99%", "percent", "metrics.taskMetrics.successRate", Number((metrics.taskMetrics.successRate * 100).toFixed(2)), 99, ">="),
            evaluateSlo("task_start_latency", "Task Start Latency (P95)", "<= 30000ms", "milliseconds", "sqlite.executions.started_at - tasks.created_at", taskStartLatencyP95, 30_000, "<=", taskStartLatencies.length === 0 ? ["no started executions available"] : []),
            evaluateSlo("approval_delivery_availability", "Approval Delivery Availability", ">= 99%", "percent", "metrics.approvalMetrics.resolvedCount / total", approvalAvailability, 99, ">="),
            evaluateSlo("recovery_success_rate", "Recovery Success Rate", ">= 95%", "percent", "metrics.recoveryMetrics.successRate", Number((metrics.recoveryMetrics.successRate * 100).toFixed(2)), 95, ">="),
            evaluateSlo("tier1_event_delivery_latency", "Tier 1 Event Delivery Latency", "<= 5000ms", "milliseconds", "doctor.eventBacklogSummary.oldestWaitSeconds", tier1LatencyMs, 5_000, "<=", doctor.eventBacklogSummary.pendingTier1Acks > 0 ? ["pending tier1 ack backlog exists"] : []),
            evaluateSlo("cost_accounting_accuracy", "Cost Accounting Accuracy", "<= 20% drift", "percent", "sqlite.tasks.estimated_cost_usd vs actual_cost_usd", costAccuracy, 20, "<="),
        ];
    }
    /**
     * Collects task start latencies in milliseconds from the database.
     * Start latency is the time between task creation and execution start.
     */
    collectTaskStartLatenciesMs() {
        const rows = this.db.connection
            .prepare(`SELECT
           (julianday(e.started_at) - julianday(t.created_at)) * 86400000.0 AS latencyMs
         FROM executions e
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE e.started_at IS NOT NULL`)
            .all();
        return rows
            .map((row) => Number(row.latencyMs ?? Number.NaN))
            .filter((value) => Number.isFinite(value) && value >= 0);
    }
    /**
     * Computes the average cost accounting accuracy as a percentage drift
     * between estimated and actual costs.
     */
    computeCostAccountingAccuracyPct() {
        const rows = this.db.connection
            .prepare(`SELECT estimated_cost_usd AS estimatedCostUsd, actual_cost_usd AS actualCostUsd
         FROM tasks
         WHERE estimated_cost_usd IS NOT NULL
           AND estimated_cost_usd > 0`)
            .all();
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
    buildIncidentPackage(taskId) {
        const timeline = this.diagnosticsService.buildIncidentTimelineReport(taskId);
        const severity = mapIncidentSeverity(timeline.summary.highestSeverity);
        const recommendedRunbooks = this.recommendRunbooks(timeline);
        const recommendedCommands = dedupe(recommendedRunbooks.flatMap((runbookId) => RUNBOOKS.find((item) => item.runbookId === runbookId)?.commands ?? []));
        return {
            incidentId: newId("incident"),
            taskId,
            severity,
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
    recommendRunbooks(timeline) {
        const matches = new Set();
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
//# sourceMappingURL=operations-governance-service.js.map