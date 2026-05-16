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

import { newId, nowIso } from "../incident-platform-support.js";
import type { RunbookExecutor } from "./runbook-executor.js";
import type { ParsedRunbook, RunbookExecutionResult } from "./types.js";

/**
 * Type of incident drill.
 */
export type IncidentDrillType = "tabletop" | "functional" | "full_simulation";

/**
 * Status of an incident drill.
 */
export type IncidentDrillStatus = "initialized" | "in_progress" | "paused" | "completed" | "cancelled";

/**
 * Scenario for an incident drill.
 */
export interface IncidentDrillScenario {
  /** Unique scenario identifier */
  scenarioId: string;
  /** Human-readable scenario name */
  name: string;
  /** Detailed scenario description */
  description: string;
  /** Type of drill */
  drillType: IncidentDrillType;
  /** Severity level for this scenario */
  severity: "P0" | "P1" | "P2" | "P3";
  /** Injection points for the simulation */
  injections: IncidentInjection[];
  /** Expected response steps */
  expectedResponseSteps: string[];
  /** Success criteria */
  successCriteria: DrillSuccessCriterion[];
  /** Time limit in seconds (0 = no limit) */
  timeLimitSeconds: number;
}

/**
 * An injection point for simulating failures.
 */
export interface IncidentInjection {
  /** Type of injection */
  injectionType: "metric_spike" | "service_failure" | "latency_injection" | "error_rate_increase" | "resource_exhaustion";
  /** Target component */
  target: string;
  /** Injection parameters */
  parameters: Record<string, unknown>;
  /** When to inject (offset from drill start in seconds) */
  injectAtSeconds: number;
  /** Duration of injection (seconds, 0 = until drill end) */
  durationSeconds: number;
}

/**
 * Criterion for measuring drill success.
 */
export interface DrillSuccessCriterion {
  /** Criterion description */
  description: string;
  /** How to evaluate (command or metric check) */
  evaluationMethod: string;
  /** Pass threshold */
  passThreshold?: number;
}

/**
 * Result of an incident drill.
 */
export interface IncidentDrillResult {
  /** Unique drill ID */
  drillId: string;
  /** Scenario that was drilled */
  scenario: IncidentDrillScenario;
  /** Drill status */
  status: IncidentDrillStatus;
  /** When the drill started */
  startedAt: string;
  /** When the drill ended */
  completedAt: string | null;
  /** Duration in milliseconds */
  durationMs: number | null;
  /** Participants in the drill */
  participants: string[];
  /** Observations recorded during the drill */
  observations: DrillObservation[];
  /** Runbook executions during the drill */
  runbookExecutions: RunbookExecutionResult[];
  /** Criteria evaluation results */
  criteriaResults: DrillCriteriaResult[];
  /** Overall drill score (0-100) */
  overallScore: number | null;
  /** Summary of the drill */
  summary: string;
  /** Issues discovered during the drill */
  issuesFound: string[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * An observation recorded during the drill.
 */
export interface DrillObservation {
  /** Observation ID */
  observationId: string;
  /** When the observation was recorded */
  timestamp: string;
  /** Who made the observation */
  observedBy: string;
  /** Category of observation */
  category: "timeline" | "communication" | "decision" | "action" | "escalation" | "other";
  /** What was observed */
  description: string;
  /** Severity if applicable */
  severity?: "good" | "concern" | "critical";
}

/**
 * Result of evaluating a success criterion.
 */
export interface DrillCriteriaResult {
  /** Criterion description */
  criterion: string;
  /** Whether it passed */
  passed: boolean;
  /** Actual value measured */
  actualValue?: number;
  /** Pass threshold */
  threshold?: number;
  /** Notes on the evaluation */
  notes: string;
}

/**
 * Configuration for incident drill execution.
 */
export interface IncidentDrillConfig {
  /** Whether to record all actions */
  recordActions: boolean;
  /** Whether to auto-inject at scheduled times */
  autoInject: boolean;
  /** Environment to run drill in (test/staging/production-simulation) */
  targetEnvironment: "test" | "staging" | "production_simulation";
}

/**
 * Default drill configuration.
 */
export const DEFAULT_INCIDENT_DRILL_CONFIG: IncidentDrillConfig = {
  recordActions: true,
  autoInject: true,
  targetEnvironment: "test",
};

/**
 * Predefined drill scenarios.
 */
export const PREDEFINED_SCENARIOS: readonly IncidentDrillScenario[] = [
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
  private readonly executor: RunbookExecutor;
  private currentDrill: IncidentDrillResult | null = null;
  private readonly config: IncidentDrillConfig;

  public constructor(executor: RunbookExecutor, config: Partial<IncidentDrillConfig> = {}) {
    this.executor = executor;
    this.config = { ...DEFAULT_INCIDENT_DRILL_CONFIG, ...config };
  }

  /**
   * Gets all available drill scenarios.
   */
  public getScenarios(): readonly IncidentDrillScenario[] {
    return PREDEFINED_SCENARIOS;
  }

  /**
   * Gets a scenario by ID.
   */
  public getScenario(scenarioId: string): IncidentDrillScenario | undefined {
    return PREDEFINED_SCENARIOS.find((s) => s.scenarioId === scenarioId);
  }

  /**
   * Initializes a new incident drill.
   */
  public initializeDrill(
    scenario: IncidentDrillScenario,
    participants: string[],
    initiatedBy: string,
  ): IncidentDrillResult {
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
  public startDrill(): IncidentDrillResult | null {
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
  public recordObservation(
    observedBy: string,
    category: DrillObservation["category"],
    description: string,
    severity?: "good" | "concern" | "critical",
  ): DrillObservation | null {
    if (!this.currentDrill || this.currentDrill.status !== "in_progress") {
      return null;
    }

    const observation: DrillObservation = {
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
  public completeDrill(
    issuesFound: string[],
    recommendations: string[],
    criteriaResults: DrillCriteriaResult[],
  ): IncidentDrillResult | null {
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
  public cancelDrill(): IncidentDrillResult | null {
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
  public getCurrentDrill(): IncidentDrillResult | null {
    return this.currentDrill;
  }

  /**
   * Adds a runbook execution to the current drill.
   */
  public addRunbookExecution(execution: RunbookExecutionResult): void {
    if (this.currentDrill) {
      this.currentDrill.runbookExecutions.push(execution);
    }
  }

  /**
   * Calculates the overall drill score.
   */
  private calculateOverallScore(criteriaResults: DrillCriteriaResult[]): number {
    if (criteriaResults.length === 0) {
      return 0;
    }

    const passedCount = criteriaResults.filter((c) => c.passed).length;
    return Math.round((passedCount / criteriaResults.length) * 100);
  }

  /**
   * Generates a summary of the drill.
   */
  private generateDrillSummary(): string {
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
  public generateDrillReport(drill: IncidentDrillResult): string {
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
