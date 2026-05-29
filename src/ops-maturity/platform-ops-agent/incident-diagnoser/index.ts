export interface IncidentThresholds {
  readonly incidentErrorRate: number;
  readonly criticalErrorRate: number;
  readonly incidentBacklog: number;
  readonly criticalBacklog: number;
}

export const DEFAULT_INCIDENT_THRESHOLDS: IncidentThresholds = {
  incidentErrorRate: 0.05,
  criticalErrorRate: 0.2,
  incidentBacklog: 200,
  criticalBacklog: 1000,
};

export function classifyOpsIncident(
  errorRate: number,
  backlog: number,
  thresholds: IncidentThresholds = DEFAULT_INCIDENT_THRESHOLDS,
): "warning" | "incident" | "critical_incident" {
  if (errorRate >= thresholds.criticalErrorRate || backlog >= thresholds.criticalBacklog) return "critical_incident";
  if (errorRate >= thresholds.incidentErrorRate || backlog >= thresholds.incidentBacklog) return "incident";
  return "warning";
}

export function summarizeIncidentDiagnosis(
  errorRate: number,
  backlog: number,
  thresholds: IncidentThresholds = DEFAULT_INCIDENT_THRESHOLDS,
): string {
  return `${classifyOpsIncident(errorRate, backlog, thresholds)}: errorRate=${errorRate}, backlog=${backlog}`;
}

export interface IncidentDiagnosis {
  readonly level: "warning" | "incident" | "critical_incident";
  readonly summary: string;
  readonly suspectedCauses: readonly string[];
  readonly recommendedAction: "monitor" | "investigate" | "escalate";
}

export class IncidentDiagnoserService {
  public constructor(private readonly thresholds: IncidentThresholds = DEFAULT_INCIDENT_THRESHOLDS) {}

  public diagnose(
    errorRate: number,
    backlog: number,
    healthStatus: "healthy" | "degraded" | "failed" = "healthy",
  ): IncidentDiagnosis {
    const level = classifyOpsIncident(errorRate, backlog, this.thresholds);
    const suspectedCauses: string[] = [];

    if (errorRate >= this.thresholds.criticalErrorRate) {
      suspectedCauses.push("ops.incident.error_rate_spike");
    } else if (errorRate >= this.thresholds.incidentErrorRate) {
      suspectedCauses.push("ops.incident.error_rate_regression");
    }

    if (backlog >= this.thresholds.criticalBacklog) {
      suspectedCauses.push("ops.incident.backlog_saturation");
    } else if (backlog >= this.thresholds.incidentBacklog) {
      suspectedCauses.push("ops.incident.backlog_growth");
    }

    if (healthStatus !== "healthy") {
      suspectedCauses.push(`ops.incident.health_${healthStatus}`);
    }

    return {
      level,
      summary: summarizeIncidentDiagnosis(errorRate, backlog, this.thresholds),
      suspectedCauses,
      recommendedAction: level === "critical_incident"
        ? "escalate"
        : level === "incident"
          ? "investigate"
          : "monitor",
    };
  }
}
