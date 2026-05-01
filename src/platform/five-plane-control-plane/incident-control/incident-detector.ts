/**
 * Incident Detector
 *
 * Provides incident detection capabilities by monitoring system health,
 * detecting anomalies, and classifying incident severity levels.
 * Works in conjunction with the Doctor service to identify and classify
 * incidents that require human attention or automated remediation.
 *
 * Severity levels follow §12.2 SEV1-4 (not p1-p4).
 * Maps to runbook priority P0-P3 per architecture mapping.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Canonical incident severity per §12.2.
 * SEV1 = critical (P0 runbook), SEV2 = high (P1), SEV3 = medium (P2), SEV4 = low (P3)
 */
export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";

/**
 * Incident lifecycle states per §12.5.
 * Includes triaged/mitigating/reviewed for complete lifecycle.
 */
export type IncidentStatus =
  | "open"
  | "triaged"
  | "acknowledged"
  | "mitigating"
  | "resolved"
  | "reviewed"
  | "escalated"
  | "closed";

export type IncidentCategory =
  | "system_health"
  | "security"
  | "data_integrity"
  | "performance"
  | "availability"
  | "configuration";

/**
 * Runbook priority mapping per §12.2.
 * SEV1 → P0 (immediate), SEV2 → P1 (urgent), SEV3 → P2 (standard), SEV4 → P3 (low)
 */
export type RunbookPriority = "P0" | "P1" | "P2" | "P3";

export interface IncidentDetection {
  incidentId: string;
  detectedAt: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  runbookPriority: RunbookPriority;
  status: IncidentStatus;
  title: string;
  description: string;
  sourceCheckId: string | null;
  affectedEntities: string[];
  symptoms: string[];
  metrics: Record<string, string | number | boolean | null>;
  autoAction?: string;
  requiresPostMortem: boolean;
}

/**
 * Configurable detection rule per §12.3.
 * Supports 5-rule architecture with automated actions.
 */
export interface DetectionRule {
  ruleId: string;
  name: string;
  description: string;
  severity: IncidentSeverity;
  condition: {
    type: "metric_threshold" | "status_match" | "error_rate" | "composite";
    metricName?: string;
    operator?: "gt" | "lt" | "eq" | "gte" | "lte";
    threshold?: number;
    matchStatus?: string[];
    expressions?: DetectionRule["condition"][];
    logic?: "and" | "or";
  };
  autoAction: string;
  enabled: boolean;
}

export interface IncidentDetectorOptions {
  maxOpenIncidents?: number;
  autoEscalateSev1AfterSeconds?: number;
  rules?: DetectionRule[];
}

function severityToRunbookPriority(sev: IncidentSeverity): RunbookPriority {
  switch (sev) {
    case "SEV1": return "P0";
    case "SEV2": return "P1";
    case "SEV3": return "P2";
    case "SEV4": return "P3";
  }
}

export class IncidentDetector {
  private readonly maxOpenIncidents: number;
  private readonly autoEscalateSev1AfterSeconds: number;
  private readonly rules: DetectionRule[];

  public constructor(private readonly options: IncidentDetectorOptions = {}) {
    this.maxOpenIncidents = options.maxOpenIncidents ?? 100;
    this.autoEscalateSev1AfterSeconds = options.autoEscalateSev1AfterSeconds ?? 300;
    this.rules = options.rules ?? this.buildDefaultRules();
  }

  /**
   * Detects incidents from doctor check reports using configurable rules.
   * Analyzes health check results and classifies issues as incidents per §12.3.
   */
  public detectFromChecks(checks: Array<{
    checkId: string;
    status: string;
    summary: string;
    findings: string[];
    metrics: Record<string, string | number | boolean | null>;
  }>): IncidentDetection[] {
    const incidents: IncidentDetection[] = [];

    for (const check of checks) {
      const matchedRule = this.findMatchingRule(check);
      if (matchedRule) {
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: matchedRule.severity,
          title: `${matchedRule.name}: ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
          autoAction: matchedRule.autoAction,
          requiresPostMortem: matchedRule.severity === "SEV1" || matchedRule.severity === "SEV2",
        }));
      } else if (check.status === "fail_closed") {
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "SEV1",
          title: `Critical failure in ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
          autoAction: "page_on_call",
          requiresPostMortem: true,
        }));
      } else if (check.status === "degraded") {
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "SEV2",
          title: `Degraded ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
          autoAction: "create_ticket",
          requiresPostMortem: true,
        }));
      } else if (check.status === "warning") {
        // R16-36 FIX #2125: P3 (warning) checks were not creating incidents.
        // Only P1/P2 checks (fail_closed/degraded) were handled. Warning status
        // should create a SEV3 (P2) incident per severity mapping.
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "SEV3",
          title: `Warning in ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
          autoAction: "log_alert",
          requiresPostMortem: false,
        }));
      } else if (check.status === "info" || check.status === "anomaly") {
        // R16-36 FIX #2125: P4 (info/anomaly) checks were not creating incidents.
        // These low-severity issues should still be tracked as SEV4 incidents
        // for observability, even if no immediate action is required.
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "SEV4",
          title: `Info anomaly in ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
          autoAction: "log_only",
          requiresPostMortem: false,
        }));
      }
    }

    return incidents;
  }

  /**
   * Creates an incident detection record.
   */
  public createIncident(input: {
    category: IncidentCategory;
    severity: IncidentSeverity;
    title: string;
    description: string;
    sourceCheckId?: string | null;
    symptoms?: string[];
    affectedEntities?: string[];
    metrics?: Record<string, string | number | boolean | null>;
    autoAction?: string;
    requiresPostMortem?: boolean;
  }): IncidentDetection {
    return {
      incidentId: this.generateIncidentId(),
      detectedAt: nowIso(),
      category: input.category,
      severity: input.severity,
      runbookPriority: severityToRunbookPriority(input.severity),
      status: "open",
      title: input.title,
      description: input.description,
      sourceCheckId: input.sourceCheckId ?? null,
      affectedEntities: input.affectedEntities ?? [],
      symptoms: input.symptoms ?? [],
      metrics: input.metrics ?? {},
      autoAction: input.autoAction,
      requiresPostMortem: input.requiresPostMortem ?? false,
    };
  }

  /**
   * Classifies the urgency level based on severity.
   */
  public classifyUrgency(severity: IncidentSeverity): "critical" | "high" | "medium" | "low" {
    switch (severity) {
      case "SEV1":
        return "critical";
      case "SEV2":
        return "high";
      case "SEV3":
        return "medium";
      case "SEV4":
        return "low";
    }
  }

  /**
   * Determines if an incident should auto-escalate based on time.
   */
  public shouldAutoEscalate(detectedAt: string, severity: IncidentSeverity): boolean {
    if (severity !== "SEV1") {
      return false;
    }
    const elapsedSeconds = (Date.now() - Date.parse(detectedAt)) / 1000;
    return elapsedSeconds >= this.autoEscalateSev1AfterSeconds;
  }

  /**
   * Evaluates a check against configured detection rules.
   */
  public evaluateRule(check: {
    checkId: string;
    status: string;
    summary: string;
    findings: string[];
    metrics: Record<string, string | number | boolean | null>;
  }): DetectionRule | null {
    return this.findMatchingRule(check);
  }

  /**
   * Adds or updates a detection rule.
   */
  public addRule(rule: DetectionRule): void {
    const index = this.rules.findIndex((r) => r.ruleId === rule.ruleId);
    if (index >= 0) {
      this.rules[index] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Gets all configured rules.
   */
  public getRules(): DetectionRule[] {
    return [...this.rules];
  }

  private findMatchingRule(check: {
    checkId: string;
    status: string;
    metrics: Record<string, string | number | boolean | null>;
  }): DetectionRule | null {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (this.evaluateCondition(rule.condition, check)) {
        return rule;
      }
    }
    return null;
  }

  private evaluateCondition(
    condition: DetectionRule["condition"],
    check: { status: string; metrics: Record<string, string | number | boolean | null> },
  ): boolean {
    switch (condition.type) {
      case "status_match":
        return condition.matchStatus?.includes(check.status) ?? false;
      case "metric_threshold":
        if (!condition.metricName || condition.operator == null || condition.threshold == null) {
          return false;
        }
        const value = check.metrics[condition.metricName];
        if (typeof value !== "number") return false;
        switch (condition.operator) {
          case "gt": return value > condition.threshold;
          case "gte": return value >= condition.threshold;
          case "lt": return value < condition.threshold;
          case "lte": return value <= condition.threshold;
          case "eq": return value === condition.threshold;
          default: return false;
        }
      case "composite":
        if (!condition.expressions || !condition.logic) return false;
        return condition.logic === "and"
          ? condition.expressions.every((expr) => this.evaluateCondition(expr, check))
          : condition.expressions.some((expr) => this.evaluateCondition(expr, check));
      default:
        return false;
    }
  }

  private buildDefaultRules(): DetectionRule[] {
    return [
      {
        ruleId: "sev1_cascade_failure",
        name: "Cascade Failure Detection",
        description: "SEV1 for multiple dependent systems failing simultaneously",
        severity: "SEV1",
        condition: {
          type: "composite",
          expressions: [
            { type: "status_match", matchStatus: ["fail_closed"] },
          ],
          logic: "and",
        },
        autoAction: "page_on_call",
        enabled: true,
      },
      {
        ruleId: "sev1_security_breach",
        name: "Security Breach Detection",
        description: "SEV1 for security-related failures",
        severity: "SEV1",
        condition: {
          type: "status_match",
          matchStatus: ["fail_closed"],
        },
        autoAction: "page_on_call",
        enabled: true,
      },
      {
        ruleId: "sev2_degraded_performance",
        name: "Degraded Performance Detection",
        description: "SEV2 for performance degradation",
        severity: "SEV2",
        condition: {
          type: "status_match",
          matchStatus: ["degraded"],
        },
        autoAction: "create_ticket",
        enabled: true,
      },
      {
        ruleId: "sev3_warning_threshold",
        name: "Warning Threshold Detection",
        description: "SEV3 for approaching threshold violations",
        severity: "SEV3",
        condition: {
          type: "metric_threshold",
          metricName: "error_rate",
          operator: "gte",
          threshold: 0.05,
        },
        autoAction: "log_alert",
        enabled: true,
      },
      {
        ruleId: "sev4_info_anomaly",
        name: "Information Anomaly Detection",
        description: "SEV4 for informational anomalies",
        severity: "SEV4",
        condition: {
          type: "metric_threshold",
          metricName: "error_rate",
          operator: "gte",
          threshold: 0.01,
        },
        autoAction: "log_only",
        enabled: true,
      },
    ];
  }

  /**
   * Maps a check ID to an incident category.
   */
  private mapCheckIdToCategory(checkId: string): IncidentCategory {
    const categoryMap: Record<string, IncidentCategory> = {
      db: "data_integrity",
      config: "configuration",
      backup: "availability",
      locks: "data_integrity",
      workers: "availability",
      event_backlog: "performance",
      audit_integrity: "security",
      provider_health: "availability",
    };
    return categoryMap[checkId] ?? "system_health";
  }

  /**
   * Generates a unique incident ID using cryptographically secure UUID.
   */
  private generateIncidentId(): string {
    return newId("incident");
  }
}
