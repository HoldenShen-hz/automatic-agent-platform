/**
 * Incident Detector
 *
 * Provides incident detection capabilities by monitoring system health,
 * detecting anomalies, and classifying incident severity levels.
 * Works in conjunction with the Doctor service to identify and classify
 * incidents that require human attention or automated remediation.
 */

import { nowIso } from "../../contracts/types/ids.js";

export type IncidentSeverity = "p1" | "p2" | "p3" | "p4";
export type IncidentStatus = "open" | "acknowledged" | "resolved" | "closed";
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
   * Analyzes health check results and classifies issues as incidents.
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
      if (check.status === "fail_closed") {
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "p1",
          title: `Critical failure in ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
        }));
      } else if (check.status === "degraded") {
        incidents.push(this.createIncident({
          category: this.mapCheckIdToCategory(check.checkId),
          severity: "p2",
          title: `Degraded ${check.checkId}`,
          description: check.summary,
          sourceCheckId: check.checkId,
          symptoms: check.findings,
          metrics: check.metrics,
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
  }): IncidentDetection {
    return {
      incidentId: this.generateIncidentId(),
      detectedAt: nowIso(),
      category: input.category,
      severity: input.severity,
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
    switch (severity) {
      case "p1":
        return "critical";
      case "p2":
        return "high";
      case "p3":
        return "medium";
      case "p4":
        return "low";
    }
  }

  /**
   * Determines if an incident should auto-escalate based on time.
   */
  public shouldAutoEscalate(detectedAt: string, severity: IncidentSeverity): boolean {
    if (severity !== "p1") {
      return false;
    }
    const elapsedSeconds = (Date.now() - Date.parse(detectedAt)) / 1000;
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
   * Generates a unique incident ID.
   */
  private generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
