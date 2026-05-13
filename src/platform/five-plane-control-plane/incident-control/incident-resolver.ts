/**
 * Incident Resolver
 *
 * Provides incident resolution capabilities including root cause analysis,
 * remediation suggestions, resolution tracking, and automated post-mortem generation.
 * Works with the IncidentDetector to process detected incidents and determine
 * appropriate resolution strategies.
 *
 * §R14-03: Incident lifecycle states updated to include triaged/mitigating/reviewed.
 * §R14-04: Post-mortem automation with 72h Post-Incident Report generation.
 */

import { nowIso } from "../../contracts/types/ids.js";
import type {
  IncidentDetection,
  IncidentSeverity,
  IncidentStatus,
} from "./incident-detector.js";
import { normalizeIncidentSeverity } from "./incident-detector.js";

/**
 * Post-mortem report generation result.
 */
export interface PostMortemReport {
  readonly reportId: string;
  readonly incidentId: string;
  readonly incidentTitle: string;
  readonly severity: IncidentSeverity;
  readonly detectedAt: string;
  readonly resolvedAt: string | null;
  readonly totalDurationMinutes: number | null;
  readonly rootCause: string;
  readonly timeline: readonly PostMortemTimelineEvent[];
  readonly impact: PostMortemImpact;
  readonly lessonsLearned: readonly string[];
  readonly actionItems: readonly PostMortemActionItem[];
  readonly generatedAt: string;
  readonly followUpRequired: boolean;
  readonly followUpDueInHours: number | null;
}

export interface PostMortemTimelineEvent {
  readonly timestamp: string;
  readonly event: string;
  readonly authorId: string | null;
  readonly phase: "detection" | "triage" | "mitigation" | "recovery" | "review";
}

export interface PostMortemImpact {
  readonly usersAffected: number | null;
  readonly revenueImpact: string | null;
  readonly durationMinutes: number | null;
  readonly servicesAffected: readonly string[];
}

export interface PostMortemActionItem {
  readonly actionId: string;
  readonly description: string;
  readonly owner: string | null;
  readonly dueInHours: number | null;
  readonly priority: "high" | "medium" | "low";
  readonly status: "open" | "in_progress" | "completed";
}

const POST_MORTEM_AUTO_TRIGGER_HOURS = 72;

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
    // SEV1 incidents require immediate manual intervention
    if (normalizeIncidentSeverity(incident.severity) === "SEV1") {
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
    return `resolution_${crypto.randomUUID()}`;
  }

  /**
   * Generates a cryptographically unique post-mortem report ID.
   */
  private generateReportId(): string {
    return `postmortem_${crypto.randomUUID()}`;
  }

  /**
   * Checks if a resolved incident is due for automatic post-mortem generation.
   * Incidents are due 72 hours after resolution.
   * §R14-04: 72h Post-Incident Report automation.
   */
  public isPostMortemDue(resolvedAt: string | null, currentTime = new Date()): boolean {
    if (!resolvedAt) return false;

    const resolvedTime = new Date(resolvedAt).getTime();
    const hoursSinceResolution = (currentTime.getTime() - resolvedTime) / (1000 * 60 * 60);

    return hoursSinceResolution >= POST_MORTEM_AUTO_TRIGGER_HOURS;
  }

  /**
   * Generates an automated post-mortem report for a resolved incident.
   * Creates a structured report with timeline, impact, lessons learned, and action items.
   * §R14-04: 72h Post-Incident Report automation.
   */
  public generatePostMortem(
    incident: IncidentDetection,
    resolution: IncidentResolution,
    timeline: readonly { timestamp: string; event: string; authorId?: string; phase: PostMortemTimelineEvent["phase"] }[],
    options?: {
      usersAffected?: number;
      revenueImpact?: string;
      servicesAffected?: readonly string[];
    },
  ): PostMortemReport {
    const detectedAt = incident.detectedAt;
    const resolvedAt = resolution.completedAt;
    const totalDurationMinutes = resolvedAt
      ? Math.round((new Date(resolvedAt).getTime() - new Date(detectedAt).getTime()) / (1000 * 60))
      : null;

    // Generate lessons learned based on incident category and resolution
    const lessonsLearned = this.generateLessonsLearned(incident, resolution);

    // Generate action items based on resolution strategy
    const actionItems = this.generateActionItems(resolution, lessonsLearned);

    const report: PostMortemReport = {
      reportId: this.generateReportId(),
      incidentId: incident.incidentId,
      incidentTitle: incident.title,
      severity: incident.severity,
      detectedAt,
      resolvedAt,
      totalDurationMinutes,
      rootCause: resolution.rootCause ?? "Root cause analysis pending",
      timeline: timeline.map((e) => ({
        timestamp: e.timestamp,
        event: e.event,
        authorId: e.authorId ?? null,
        phase: e.phase,
      })),
      impact: {
        usersAffected: options?.usersAffected ?? null,
        revenueImpact: options?.revenueImpact ?? null,
        durationMinutes: totalDurationMinutes,
        servicesAffected: options?.servicesAffected ?? [],
      },
      lessonsLearned,
      actionItems,
      generatedAt: nowIso(),
      followUpRequired: actionItems.some((a) => a.priority === "high"),
      followUpDueInHours: actionItems.some((a) => a.priority === "high") ? 168 : 720, // 1 week for high, 30 days for others
    };

    return report;
  }

  /**
   * Generates lessons learned based on incident characteristics and resolution.
   */
  private generateLessonsLearned(
    incident: IncidentDetection,
    resolution: IncidentResolution,
  ): readonly string[] {
    const lessons: string[] = [];

    // Add category-specific lessons
    switch (incident.category) {
      case "availability":
        lessons.push("Review availability monitoring and alerting thresholds");
        lessons.push("Consider implementing automatic failover for critical services");
        break;
      case "performance":
        lessons.push("Performance testing should include failure mode analysis");
        lessons.push("Consider implementing circuit breakers for dependent services");
        break;
      case "data_integrity":
        lessons.push("Data validation and consistency checks should be enhanced");
        lessons.push("Consider implementing automatic data repair mechanisms");
        break;
      case "security":
        lessons.push("Security review needed for affected components");
        lessons.push("Consider implementing additional security monitoring");
        break;
      case "configuration":
        lessons.push("Configuration management process should be reviewed");
        lessons.push("Consider implementing configuration validation");
        break;
      default:
        lessons.push("Incident response process should be reviewed");
    }

    // Add resolution-specific lessons
    switch (resolution.strategy) {
      case "self_heal":
        lessons.push("Self-healing mechanisms worked as expected");
        lessons.push("Review effectiveness of automated remediation");
        break;
      case "automated":
        lessons.push("Automated remediation helped reduce MTTR");
        lessons.push("Review automation coverage for similar incidents");
        break;
      case "assisted":
        lessons.push("Human expertise was critical for resolution");
        lessons.push("Consider additional tooling for faster diagnosis");
        break;
      case "manual":
        lessons.push("Manual intervention was required - evaluate automation opportunities");
        lessons.push("Consider runbook automation for similar incidents");
        break;
    }

    return lessons;
  }

  /**
   * Generates action items from lessons learned.
   */
  private generateActionItems(
    resolution: IncidentResolution,
    lessons: readonly string[],
  ): readonly PostMortemActionItem[] {
    const actionItems: PostMortemActionItem[] = [];

    // Create action items from lessons learned
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i]!;
      actionItems.push({
        actionId: `actionitem_${crypto.randomUUID()}`,
        description: lesson,
        owner: null,
        dueInHours: i === 0 ? 168 : 720, // First item due in 1 week
        priority: i === 0 ? "high" : i < 3 ? "medium" : "low",
        status: "open",
      });
    }

    // Add resolution-specific action items
    if (resolution.strategy === "manual") {
      actionItems.push({
        actionId: `actionitem_${crypto.randomUUID()}`,
        description: "Evaluate automation opportunities to prevent similar manual interventions",
        owner: null,
        dueInHours: 720,
        priority: "medium",
        status: "open",
      });
    }

    return actionItems;
  }
}
