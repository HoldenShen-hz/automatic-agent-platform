/**
 * Incident Resolver
 *
 * Provides incident resolution capabilities including root cause analysis,
 * remediation suggestions, and resolution tracking. Works with the IncidentDetector
 * to process detected incidents and determine appropriate resolution strategies.
 */

import { nowIso } from "../../contracts/types/ids.js";
import type {
  IncidentDetection,
  IncidentSeverity,
  IncidentStatus,
} from "./incident-detector.js";

export type ResolutionStrategy = "self_heal" | "automated" | "assisted" | "manual";
export type ResolutionStatus = "pending" | "in_progress" | "completed" | "failed";

export interface ResolutionAction {
  actionId: string;
  step: number;
  description: string;
  strategy: ResolutionStrategy;
  estimatedDurationSeconds: number;
  executedAt: string | null;
  completedAt: string | null;
  outcome: "success" | "failure" | "skipped" | null;
  errorMessage: string | null;
}

export interface IncidentResolution {
  resolutionId: string;
  incidentId: string;
  status: ResolutionStatus;
  strategy: ResolutionStrategy;
  startedAt: string;
  completedAt: string | null;
  rootCause: string | null;
  actions: ResolutionAction[];
  resolutionNotes: string;
  resolvedBy: string;
}

export interface IncidentResolverOptions {
  maxSelfHealAttempts?: number;
  selfHealTimeoutSeconds?: number;
  escalationThresholdSeconds?: number;
}

export class IncidentResolver {
  private readonly maxSelfHealAttempts: number;
  private readonly selfHealTimeoutSeconds: number;
  private readonly escalationThresholdSeconds: number;

  public constructor(private readonly options: IncidentResolverOptions = {}) {
    this.maxSelfHealAttempts = options.maxSelfHealAttempts ?? 3;
    this.selfHealTimeoutSeconds = options.selfHealTimeoutSeconds ?? 60;
    this.escalationThresholdSeconds = options.escalationThresholdSeconds ?? 600;
  }

  /**
   * Creates a resolution plan for an incident.
   * Analyzes the incident and determines appropriate resolution strategy.
   */
  public createResolution(incident: IncidentDetection): IncidentResolution {
    const strategy = this.determineStrategy(incident);

    return {
      resolutionId: this.generateResolutionId(),
      incidentId: incident.incidentId,
      status: "pending",
      strategy,
      startedAt: nowIso(),
      completedAt: null,
      rootCause: null,
      actions: this.buildActions(incident, strategy),
      resolutionNotes: "",
      resolvedBy: "system",
    };
  }

  /**
   * Determines the appropriate resolution strategy based on incident characteristics.
   */
  public determineStrategy(incident: IncidentDetection): ResolutionStrategy {
    // P1 incidents require immediate manual intervention
    if (incident.severity === "p1") {
      return "manual";
    }

    // Security incidents should be manually handled
    if (incident.category === "security") {
      return "manual";
    }

    // Data integrity issues require assisted resolution
    if (incident.category === "data_integrity") {
      return "assisted";
    }

    // Availability issues with clear automated remediation can be self-healed
    if (incident.category === "availability" && incident.symptoms.length > 0) {
      return "automated";
    }

    // Performance issues can be self-healed
    if (incident.category === "performance") {
      return "self_heal";
    }

    // Configuration issues typically need assisted resolution
    if (incident.category === "configuration") {
      return "assisted";
    }

    // Default to assisted for unknown categories
    return "assisted";
  }

  /**
   * Builds resolution actions based on incident and strategy.
   */
  public buildActions(
    incident: IncidentDetection,
    strategy: ResolutionStrategy,
  ): ResolutionAction[] {
    const actions: ResolutionAction[] = [];

    switch (strategy) {
      case "self_heal":
        actions.push(
          this.createAction(1, "Monitor and collect metrics", strategy, 30),
          this.createAction(2, "Apply automated remediation", strategy, 60),
          this.createAction(3, "Verify resolution", strategy, 30),
        );
        break;

      case "automated":
        actions.push(
          this.createAction(1, "Isolate affected components", strategy, 45),
          this.createAction(2, "Apply automated fix", strategy, 120),
          this.createAction(3, "Validate service restoration", strategy, 60),
          this.createAction(4, "Remove isolation", strategy, 30),
        );
        break;

      case "assisted":
        actions.push(
          this.createAction(1, "Gather diagnostic information", strategy, 60),
          this.createAction(2, "Analyze root cause", strategy, 120),
          this.createAction(3, "Prepare remediation plan", strategy, 90),
          this.createAction(4, "Execute remediation", strategy, 180),
        );
        break;

      case "manual":
        actions.push(
          this.createAction(1, "Page on-call engineer", strategy, 5),
          this.createAction(2, "Establish incident commander", strategy, 10),
          this.createAction(3, "Gather status and impact", strategy, 60),
          this.createAction(4, "Develop resolution plan", strategy, 120),
          this.createAction(5, "Execute manual remediation", strategy, 300),
          this.createAction(6, "Validate and close", strategy, 60),
        );
        break;
    }

    return actions;
  }

  /**
   * Checks if an incident should be escalated.
   */
  public shouldEscalate(resolution: IncidentResolution, startedAt: string): boolean {
    if (resolution.status === "completed") {
      return false;
    }

    const elapsedSeconds = (Date.now() - Date.parse(startedAt)) / 1000;

    // Escalate if taking too long based on strategy
    const threshold = this.getEscalationThreshold(resolution.strategy);
    return elapsedSeconds >= threshold;
  }

  /**
   * Completes a resolution with the given notes.
   */
  public completeResolution(
    resolution: IncidentResolution,
    rootCause: string,
    notes: string,
    resolvedBy: string,
  ): IncidentResolution {
    return {
      ...resolution,
      status: "completed",
      completedAt: nowIso(),
      rootCause,
      resolutionNotes: notes,
      resolvedBy,
    };
  }

  /**
   * Marks a resolution as failed.
   */
  public failResolution(
    resolution: IncidentResolution,
    errorMessage: string,
  ): IncidentResolution {
    return {
      ...resolution,
      status: "failed",
      completedAt: nowIso(),
      resolutionNotes: `Resolution failed: ${errorMessage}`,
    };
  }

  /**
   * Gets escalation threshold based on resolution strategy.
   */
  private getEscalationThreshold(strategy: ResolutionStrategy): number {
    switch (strategy) {
      case "self_heal":
        return this.selfHealTimeoutSeconds * 2;
      case "automated":
        return this.selfHealTimeoutSeconds * 4;
      case "assisted":
        return this.escalationThresholdSeconds;
      case "manual":
        return this.escalationThresholdSeconds * 2;
    }
  }

  /**
   * Creates a resolution action.
   */
  private createAction(
    step: number,
    description: string,
    strategy: ResolutionStrategy,
    estimatedDurationSeconds: number,
  ): ResolutionAction {
    return {
      actionId: `action_${Date.now()}_${step}`,
      step,
      description,
      strategy,
      estimatedDurationSeconds,
      executedAt: null,
      completedAt: null,
      outcome: null,
      errorMessage: null,
    };
  }

  /**
   * Generates a unique resolution ID.
   */
  private generateResolutionId(): string {
    return `resolution_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
