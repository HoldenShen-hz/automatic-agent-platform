/**
 * Incident Resolver
 *
 * Provides incident resolution capabilities including root cause analysis,
 * remediation suggestions, and resolution tracking. Works with the IncidentDetector
 * to process detected incidents and determine appropriate resolution strategies.
 */

import { nowIso } from "../../contracts/types/ids.js";
import { newId } from "../../contracts/types/ids.js";
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
  postMortemDueHours?: number;
}

/**
 * Post-incident report per §12.5/§60.3.
 * Required within 72h for SEV1/SEV2 incidents.
 */
export interface PostIncidentReport {
  reportId: string;
  incidentId: string;
  createdAt: string;
  dueBy: string;
  status: "pending" | "in_progress" | "submitted" | "approved";
  rootCause: string;
  impact: string;
  timeline: string;
  lessonsLearned: string;
  actionItems: readonly ActionItem[];
  createdBy: string;
  approvedBy?: string;
}

export interface ActionItem {
  itemId: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  owner: string;
  dueDate: string | null;
  status: "open" | "in_progress" | "completed";
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
    // SEV1 incidents require immediate manual intervention
    if (incident.severity === "SEV1") {
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
   * Creates a post-incident report for SEV1/SEV2 incidents per §12.5/§60.3.
   * Due within 72 hours of incident resolution.
   */
  public createPostIncidentReport(
    incident: IncidentDetection,
    options?: {
      rootCause?: string;
      impact?: string;
      timeline?: string;
      lessonsLearned?: string;
      actionItems?: ActionItem[];
    },
  ): PostIncidentReport {
    const postMortemDueHours = this.options.postMortemDueHours ?? 72;
    const createdAt = nowIso();
    const dueByDate = new Date(Date.now() + postMortemDueHours * 60 * 60 * 1000);

    return {
      reportId: newId("pm_report"),
      incidentId: incident.incidentId,
      createdAt,
      dueBy: dueByDate.toISOString(),
      status: "pending",
      rootCause: options?.rootCause ?? "Under investigation",
      impact: options?.impact ?? "To be determined",
      timeline: options?.timeline ?? "To be documented",
      lessonsLearned: options?.lessonsLearned ?? "To be documented",
      actionItems: options?.actionItems ?? [],
      createdBy: "system",
    };
  }

  /**
   * Checks if an incident requires post-mortem per §12.5.
   * SEV1 and SEV2 incidents require post-incident reports.
   */
  public requiresPostMortem(incident: IncidentDetection): boolean {
    return incident.severity === "SEV1" || incident.severity === "SEV2";
  }

  /**
   * Checks if post-mortem is overdue (past 72h deadline).
   */
  public isPostMortemOverdue(report: PostIncidentReport): boolean {
    if (report.status === "approved") return false;
    return Date.now() > Date.parse(report.dueBy);
  }

  /**
   * Completes post-mortem with approval.
   */
  public approvePostMortemReport(
    report: PostIncidentReport,
    approvedBy: string,
  ): PostIncidentReport {
    return {
      ...report,
      status: "approved",
      approvedBy,
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
      actionId: newId("action"),
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
   * Generates a unique resolution ID using cryptographically secure UUID.
   * §R14-11: Incident ID must use crypto.randomUUID() not Math.random()
   */
  private generateResolutionId(): string {
    return newId("resolution");
  }
}
