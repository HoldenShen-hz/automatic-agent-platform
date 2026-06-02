/**
 * Incident Detector
 *
 * Provides incident detection capabilities by monitoring system health,
 * detecting anomalies, and classifying incident severity levels.
 * Works in conjunction with the Doctor service to identify and classify
 * incidents that require human attention or automated remediation.
 *
 * Severity levels use SEV1-4 per unified severity standard (§R14-02).
 * Incident lifecycle states: open -> triaged -> mitigating -> reviewed -> resolved -> closed (§R14-03).
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { UnifiedSeverity } from "../../contracts/types/unified-severity.js";

export type IncidentSeverity = UnifiedSeverity | "p1" | "p2" | "p3" | "p4";
export type IncidentStatus = "open" | "triaged" | "mitigating" | "reviewed" | "resolved" | "closed";
export type IncidentCategory =
  | "system_health"
  | "security"
  | "data_integrity"
  | "performance"
  | "availability"
  | "configuration";

export interface IncidentDetection {
  incidentId: string;
  detectedAt: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  sourceCheckId: string | null;
  affectedEntities: string[];
  symptoms: string[];
  metrics: Record<string, string | number | boolean | null>;
}

export interface IncidentDetectorOptions {
  maxOpenIncidents?: number;
  autoEscalateP1AfterSeconds?: number;
}

export class IncidentDetector {
  private readonly maxOpenIncidents: number;
  private readonly autoEscalateP1AfterSeconds: number;

  public constructor(private readonly options: IncidentDetectorOptions = {}) {
    this.maxOpenIncidents = options.maxOpenIncidents ?? 100;
    this.autoEscalateP1AfterSeconds = options.autoEscalateP1AfterSeconds ?? 300;
  }

  /**
   * Detects incidents from doctor check reports.
   * Analyzes health check results and classifies issues as incidents using SEV1-4.
   * Also applies detection rules for additional SEV1-3 coverage.
   * §R14-05: Five rules for SEV1-3 detection.
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
      const fallbackIncident = check.status === "fail_closed"
        ? this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "SEV1",
          title: `Critical failure in ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
        })
        : check.status === "degraded"
          ? this.createIncident({
            category: this.mapCheckIdToCategory(check.checkId),
            severity: "SEV2",
            title: `Degraded ${check.checkId}`,
            description: check.summary,
            sourceCheckId: check.checkId,
            symptoms: check.findings,
            metrics: check.metrics,
          })
          : null;

      const ruleResults = applyDetectionRules(check.metrics);
      let matchedRule = false;
      for (const { rule, matched } of ruleResults) {
        if (matched) {
          matchedRule = true;
          incidents.push(this.createIncident({
            category: rule.category,
            severity: rule.severity,
            title: rule.name,
            description: rule.description,
            sourceCheckId: check.checkId,
            symptoms: check.findings,
            metrics: check.metrics,
          }));
        }
      }

      if (!matchedRule && fallbackIncident != null) {
        incidents.push(fallbackIncident);
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
  }): IncidentDetection {
    return {
      incidentId: this.generateIncidentId(),
      detectedAt: nowIso(),
      category: input.category,
      severity: normalizeIncidentSeverity(input.severity),
      status: "open",
      title: input.title,
      description: input.description,
      sourceCheckId: input.sourceCheckId ?? null,
      affectedEntities: input.affectedEntities ?? [],
      symptoms: input.symptoms ?? [],
      metrics: input.metrics ?? {},
    };
  }

  /**
   * Classifies the urgency level based on severity.
   */
  public classifyUrgency(severity: IncidentSeverity): "critical" | "high" | "medium" | "low" {
    switch (normalizeIncidentSeverity(severity)) {
      case "SEV1":
        return "critical";
      case "SEV2":
        return "high";
      case "SEV3":
        return "medium";
      case "SEV4":
        return "low";
      default:
        return "low";
    }
  }

  /**
   * Determines if an incident should auto-escalate based on time.
   * SEV1 incidents auto-escalate after configured threshold.
   */
  public shouldAutoEscalate(detectedAt: string, severity: IncidentSeverity): boolean {
    if (normalizeIncidentSeverity(severity) !== "SEV1") {
      return false;
    }
    const detectedAtMs = Date.parse(detectedAt);
    if (!Number.isFinite(detectedAtMs)) {
      return true;
    }
    const elapsedSeconds = (Date.now() - detectedAtMs) / 1000;
    return elapsedSeconds >= this.autoEscalateP1AfterSeconds;
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
   * Generates a cryptographically unique incident ID.
   */
  private generateIncidentId(): string {
    return newId("incident");
  }
}

export function normalizeIncidentSeverity(severity: IncidentSeverity | string): IncidentSeverity {
  switch (severity) {
    case "p1":
      return "SEV1";
    case "p2":
      return "SEV2";
    case "p3":
      return "SEV3";
    case "p4":
      return "SEV4";
    default:
      return severity as IncidentSeverity;
  }
}

/**
 * Detection rule for incident classification.
 * §R14-05: Five rules for SEV1-3 detection.
 */
export interface IncidentDetectionRule {
  ruleId: string;
  name: string;
  description: string;
  severity: IncidentSeverity;
  condition: (metrics: Record<string, string | number | boolean | null>) => boolean;
  category: IncidentCategory;
  dimensions: readonly string[];
}

/**
 * Default detection rules for SEV1-3 incidents.
 * Five rules covering different failure modes.
 */
export const DEFAULT_DETECTION_RULES: IncidentDetectionRule[] = [
  {
    ruleId: "sev1_availability_collapse",
    name: "SEV1 Availability Collapse",
    description: "Availability drops below 95% or error rate exceeds 5%",
    severity: "SEV1",
    condition: (m) => {
      const availability = typeof m.availability === "number" ? m.availability : null;
      const errorRate = typeof m.error_rate === "number" ? m.error_rate : null;
      return (availability !== null && availability < 95) || (errorRate !== null && errorRate > 5);
    },
    category: "availability",
    dimensions: ["availability", "error_rate"],
  },
  {
    ruleId: "sev1_data_integrity_failure",
    name: "SEV1 Data Integrity Failure",
    description: "Critical data integrity check failure",
    severity: "SEV1",
    condition: (m) => typeof m.data_integrity_check === "boolean" && m.data_integrity_check === false,
    category: "data_integrity",
    dimensions: ["data_integrity_check"],
  },
  {
    ruleId: "sev2_degraded_service",
    name: "SEV2 Degraded Service",
    description: "Service degraded with latency above threshold or error rate elevated",
    severity: "SEV2",
    condition: (m) => {
      const latency = typeof m.latency_p99 === "number" ? m.latency_p99 : null;
      const errorRate = typeof m.error_rate === "number" ? m.error_rate : null;
      return (latency !== null && latency > 1000) || (errorRate !== null && errorRate > 1);
    },
    category: "performance",
    dimensions: ["latency_p99", "error_rate"],
  },
  {
    ruleId: "sev2_security_anomaly",
    name: "SEV2 Security Anomaly",
    description: "Security anomaly detected requiring investigation",
    severity: "SEV2",
    condition: (m) => typeof m.security_events === "number" && m.security_events > 10,
    category: "security",
    dimensions: ["security_events"],
  },
  {
    ruleId: "sev3_config_drift",
    name: "SEV3 Configuration Drift",
    description: "Configuration drift detected that may impact reliability",
    severity: "SEV3",
    condition: (m) => typeof m.config_drift_detected === "boolean" && m.config_drift_detected === true,
    category: "configuration",
    dimensions: ["config_drift_detected"],
  },
];

/**
 * Applies detection rules to metrics and returns matching incidents.
 * §R14-05: Five rules for SEV1-3.
 */
export function applyDetectionRules(
  metrics: Record<string, string | number | boolean | null>,
  rules: IncidentDetectionRule[] = DEFAULT_DETECTION_RULES,
): Array<{ rule: IncidentDetectionRule; matched: boolean }> {
  const severityOrder: Record<IncidentSeverity, number> = {
    SEV1: 0,
    SEV2: 1,
    SEV3: 2,
    SEV4: 3,
    p1: 0,
    p2: 1,
    p3: 2,
    p4: 3,
  };
  const matchedDimensionGroups = new Set<string>();
  return [...rules]
    .sort((left, right) => {
      const severityDelta = severityOrder[normalizeIncidentSeverity(left.severity)] - severityOrder[normalizeIncidentSeverity(right.severity)];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.ruleId.localeCompare(right.ruleId);
    })
    .map((rule) => {
      const matched = rule.condition(metrics);
      if (!matched) {
        return { rule, matched: false };
      }
      const dimensionGroup = [...rule.dimensions].sort().join("|");
      if (matchedDimensionGroups.has(dimensionGroup)) {
        return { rule, matched: false };
      }
      matchedDimensionGroups.add(dimensionGroup);
      return { rule, matched: true };
    });
}
