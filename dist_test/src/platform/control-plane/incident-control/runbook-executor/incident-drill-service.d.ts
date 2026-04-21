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
import type { RunbookExecutor } from "./runbook-executor.js";
import type { RunbookExecutionResult } from "./types.js";
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
export declare const DEFAULT_INCIDENT_DRILL_CONFIG: IncidentDrillConfig;
/**
 * Predefined drill scenarios.
 */
export declare const PREDEFINED_SCENARIOS: readonly IncidentDrillScenario[];
/**
 * Incident Drill Service
 *
 * Manages incident response training through simulated scenarios.
 */
export declare class IncidentDrillService {
    private readonly executor;
    private currentDrill;
    private readonly config;
    constructor(executor: RunbookExecutor, config?: Partial<IncidentDrillConfig>);
    /**
     * Gets all available drill scenarios.
     */
    getScenarios(): readonly IncidentDrillScenario[];
    /**
     * Gets a scenario by ID.
     */
    getScenario(scenarioId: string): IncidentDrillScenario | undefined;
    /**
     * Initializes a new incident drill.
     */
    initializeDrill(scenario: IncidentDrillScenario, participants: string[], initiatedBy: string): IncidentDrillResult;
    /**
     * Starts the current drill.
     */
    startDrill(): IncidentDrillResult | null;
    /**
     * Records an observation during the drill.
     */
    recordObservation(observedBy: string, category: DrillObservation["category"], description: string, severity?: "good" | "concern" | "critical"): DrillObservation | null;
    /**
     * Completes the current drill with results.
     */
    completeDrill(issuesFound: string[], recommendations: string[], criteriaResults: DrillCriteriaResult[]): IncidentDrillResult | null;
    /**
     * Cancels the current drill.
     */
    cancelDrill(): IncidentDrillResult | null;
    /**
     * Gets the current drill state.
     */
    getCurrentDrill(): IncidentDrillResult | null;
    /**
     * Adds a runbook execution to the current drill.
     */
    addRunbookExecution(execution: RunbookExecutionResult): void;
    /**
     * Calculates the overall drill score.
     */
    private calculateOverallScore;
    /**
     * Generates a summary of the drill.
     */
    private generateDrillSummary;
    /**
     * Generates a detailed report of the drill.
     */
    generateDrillReport(drill: IncidentDrillResult): string;
}
