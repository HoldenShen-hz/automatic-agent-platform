/**
 * Incident Drill Service
 *
 * Provides incident response training through simulated scenarios.
 *
 * ## Purpose
 *
 * Allows operators to practice incident response without affecting production:
 * - Simulate alert triggers
 * - Test runbook execution
 * - Verify escalation paths
 * - Measure response time
 *
 * ## Drill Types
 *
 * - tabletop: Discussion-based walkthrough of incident response
 * - functional: Execute runbooks in a test environment
 * - fullSimulation: End-to-end simulation with injected failures
 */
import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
/**
 * Default drill configuration.
 */
export const DEFAULT_INCIDENT_DRILL_CONFIG = {
    recordActions: true,
    autoInject: true,
    targetEnvironment: "test",
};
/**
 * Predefined drill scenarios.
 */
export const PREDEFINED_SCENARIOS = [
    {
        scenarioId: "worker_mass_disconnect_drill",
        name: "Worker Mass Disconnect",
        description: "Simulates a scenario where all workers disconnect simultaneously, causing task execution to halt.",
        drillType: "full_simulation",
        severity: "P0",
        injections: [
            {
                injectionType: "service_failure",
                target: "worker_coordinator",
                parameters: { disconnectCount: "all", reason: "network_partition" },
                injectAtSeconds: 30,
                durationSeconds: 0,
            },
        ],
        expectedResponseSteps: [
            "Verify alert is real (not a monitoring glitch)",
            "Check worker fleet status",
            "Identify scope of disconnect",
            "Initiate worker reconnect protocol",
            "Verify task queue health",
            "Confirm execution recovery",
        ],
        successCriteria: [
            { description: "Time to detect incident", evaluationMethod: "drill.observation.timeline.detect_time", passThreshold: 60 },
            { description: "Time to begin response", evaluationMethod: "drill.observation.timeline.response_start_time", passThreshold: 180 },
            { description: "Correct escalation path used", evaluationMethod: "drill.escalation.correct_path_used" },
        ],
        timeLimitSeconds: 600,
    },
    {
        scenarioId: "approval_channel_outage_drill",
        name: "Approval Channel Unavailable",
        description: "Simulates an approval channel outage where pending approvals accumulate.",
        drillType: "functional",
        severity: "P1",
        injections: [
            {
                injectionType: "service_failure",
                target: "approval_channel",
                parameters: { failureType: "delivery_failure" },
                injectAtSeconds: 15,
                durationSeconds: 120,
            },
        ],
        expectedResponseSteps: [
            "Identify approval channel failure",
            "Check pending approval backlog",
            "Verify no policy bypass is occurring",
            "Switch to fallback notification channel",
            "Monitor backlog resolution",
        ],
        successCriteria: [
            { description: "Backlog does not grow after mitigation", evaluationMethod: "drill.approval.backlog_stable" },
            { description: "No policy bypass detected", evaluationMethod: "drill.policy.bypass_detected", passThreshold: 0 },
        ],
        timeLimitSeconds: 300,
    },
    {
        scenarioId: "cost_spike_drill",
        name: "Cost Spike Containment",
        description: "Simulates a rapid budget drift requiring immediate cost containment.",
        drillType: "tabletop",
        severity: "P2",
        injections: [
            {
                injectionType: "metric_spike",
                target: "cost_tracking",
                parameters: { spikePercent: 200, affectedTasks: "high_priority" },
                injectAtSeconds: 10,
                durationSeconds: 0,
            },
        ],
        expectedResponseSteps: [
            "Verify cost spike is real",
            "Identify offending tasks",
            "Implement cost guard",
            "Isolate high-cost tasks",
            "Monitor cost recovery",
        ],
        successCriteria: [
            { description: "Correct root cause identified", evaluationMethod: "drill.decision.correct_root_cause" },
            { description: "Appropriate containment actions taken", evaluationMethod: "drill.action.appropriate" },
        ],
        timeLimitSeconds: 450,
    },
];
/**
 * Incident Drill Service
 *
 * Manages incident response training through simulated scenarios.
 */
export class IncidentDrillService {
    executor;
    currentDrill = null;
    config;
    constructor(executor, config = {}) {
        this.executor = executor;
        this.config = { ...DEFAULT_INCIDENT_DRILL_CONFIG, ...config };
    }
    /**
     * Gets all available drill scenarios.
     */
    getScenarios() {
        return PREDEFINED_SCENARIOS;
    }
    /**
     * Gets a scenario by ID.
     */
    getScenario(scenarioId) {
        return PREDEFINED_SCENARIOS.find((s) => s.scenarioId === scenarioId);
    }
    /**
     * Initializes a new incident drill.
     */
    initializeDrill(scenario, participants, initiatedBy) {
        const drillId = newId("incident_drill");
        const startedAt = nowIso();
        this.currentDrill = {
            drillId,
            scenario,
            status: "initialized",
            startedAt,
            completedAt: null,
            durationMs: null,
            participants,
            observations: [],
            runbookExecutions: [],
            criteriaResults: [],
            overallScore: null,
            summary: `Drill "${scenario.name}" initialized by ${initiatedBy}`,
            issuesFound: [],
            recommendations: [],
        };
        return this.currentDrill;
    }
    /**
     * Starts the current drill.
     */
    startDrill() {
        if (!this.currentDrill || this.currentDrill.status !== "initialized") {
            return null;
        }
        this.currentDrill.status = "in_progress";
        this.currentDrill.startedAt = nowIso();
        return this.currentDrill;
    }
    /**
     * Records an observation during the drill.
     */
    recordObservation(observedBy, category, description, severity) {
        if (!this.currentDrill || this.currentDrill.status !== "in_progress") {
            return null;
        }
        const observation = {
            observationId: newId("drill_obs"),
            timestamp: nowIso(),
            observedBy,
            category,
            description,
            ...(severity != null ? { severity } : {}),
        };
        this.currentDrill.observations.push(observation);
        return observation;
    }
    /**
     * Completes the current drill with results.
     */
    completeDrill(issuesFound, recommendations, criteriaResults) {
        if (!this.currentDrill) {
            return null;
        }
        const completedAt = nowIso();
        this.currentDrill.status = "completed";
        this.currentDrill.completedAt = completedAt;
        this.currentDrill.durationMs = new Date(completedAt).getTime() - new Date(this.currentDrill.startedAt).getTime();
        this.currentDrill.issuesFound = issuesFound;
        this.currentDrill.recommendations = recommendations;
        this.currentDrill.criteriaResults = criteriaResults;
        this.currentDrill.overallScore = this.calculateOverallScore(criteriaResults);
        this.currentDrill.summary = this.generateDrillSummary();
        const result = this.currentDrill;
        this.currentDrill = null;
        return result;
    }
    /**
     * Cancels the current drill.
     */
    cancelDrill() {
        if (!this.currentDrill) {
            return null;
        }
        const completedAt = nowIso();
        this.currentDrill.status = "cancelled";
        this.currentDrill.completedAt = completedAt;
        this.currentDrill.durationMs = new Date(completedAt).getTime() - new Date(this.currentDrill.startedAt).getTime();
        this.currentDrill.summary = `Drill "${this.currentDrill.scenario.name}" was cancelled`;
        const result = this.currentDrill;
        this.currentDrill = null;
        return result;
    }
    /**
     * Gets the current drill state.
     */
    getCurrentDrill() {
        return this.currentDrill;
    }
    /**
     * Adds a runbook execution to the current drill.
     */
    addRunbookExecution(execution) {
        if (this.currentDrill) {
            this.currentDrill.runbookExecutions.push(execution);
        }
    }
    /**
     * Calculates the overall drill score.
     */
    calculateOverallScore(criteriaResults) {
        if (criteriaResults.length === 0) {
            return 0;
        }
        const passedCount = criteriaResults.filter((c) => c.passed).length;
        return Math.round((passedCount / criteriaResults.length) * 100);
    }
    /**
     * Generates a summary of the drill.
     */
    generateDrillSummary() {
        if (!this.currentDrill) {
            return "";
        }
        const { scenario, status, overallScore, durationMs, issuesFound, recommendations } = this.currentDrill;
        const parts = [
            `Drill "${scenario.name}" (${scenario.severity}) ${status}`,
        ];
        if (overallScore !== null) {
            parts.push(`Score: ${overallScore}%`);
        }
        if (durationMs !== null) {
            const minutes = Math.round(durationMs / 60000);
            parts.push(`Duration: ${minutes} minutes`);
        }
        if (issuesFound.length > 0) {
            parts.push(`Issues found: ${issuesFound.length}`);
        }
        if (recommendations.length > 0) {
            parts.push(`Recommendations: ${recommendations.length}`);
        }
        return parts.join(" | ");
    }
    /**
     * Generates a detailed report of the drill.
     */
    generateDrillReport(drill) {
        const lines = [
            `# Incident Drill Report`,
            ``,
            `- Drill ID: \`${drill.drillId}\``,
            `- Scenario: ${drill.scenario.name}`,
            `- Severity: ${drill.scenario.severity}`,
            `- Type: ${drill.scenario.drillType}`,
            `- Status: ${drill.status}`,
            `- Participants: ${drill.participants.join(", ")}`,
            `- Started At: ${drill.startedAt}`,
            drill.completedAt ? `- Completed At: ${drill.completedAt}` : null,
            drill.durationMs ? `- Duration: ${Math.round(drill.durationMs / 1000)}s` : null,
            drill.overallScore !== null ? `- Overall Score: ${drill.overallScore}%` : null,
            ``,
            `## Scenario`,
            ``,
            drill.scenario.description,
            ``,
            `## Summary`,
            ``,
            drill.summary,
            ``,
            `## Observations`,
            ``,
        ];
        for (const obs of drill.observations) {
            const icon = obs.severity === "good" ? "✅" : obs.severity === "concern" ? "⚠️" : obs.severity === "critical" ? "❌" : "📝";
            lines.push(`- [${obs.timestamp}] ${icon} **${obs.category}** (${obs.observedBy}): ${obs.description}`);
        }
        if (drill.criteriaResults.length > 0) {
            lines.push(``, `## Criteria Results`, ``);
            for (const criteria of drill.criteriaResults) {
                const icon = criteria.passed ? "✅" : "❌";
                lines.push(`${icon} ${criteria.criterion}`);
                lines.push(`   - ${criteria.notes}`);
            }
        }
        if (drill.issuesFound.length > 0) {
            lines.push(``, `## Issues Found`, ``);
            for (const issue of drill.issuesFound) {
                lines.push(`- ${issue}`);
            }
        }
        if (drill.recommendations.length > 0) {
            lines.push(``, `## Recommendations`, ``);
            for (const rec of drill.recommendations) {
                lines.push(`- ${rec}`);
            }
        }
        return lines.filter((l) => l !== null).join("\n");
    }
}
//# sourceMappingURL=incident-drill-service.js.map