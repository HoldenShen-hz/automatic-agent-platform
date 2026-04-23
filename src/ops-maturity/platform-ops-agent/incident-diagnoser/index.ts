export function classifyOpsIncident(errorRate: number, backlog: number): "warning" | "incident" | "critical_incident" {
  if (errorRate >= 0.2 || backlog >= 1000) return "critical_incident";
  if (errorRate >= 0.05 || backlog >= 200) return "incident";
  return "warning";
}

export function summarizeIncidentDiagnosis(errorRate: number, backlog: number): string {
  return `${classifyOpsIncident(errorRate, backlog)}: errorRate=${errorRate}, backlog=${backlog}`;
}

export interface IncidentDiagnosis {
  readonly level: "warning" | "incident" | "critical_incident";
  readonly summary: string;
  readonly suspectedCauses: readonly string[];
  readonly recommendedAction: "monitor" | "investigate" | "escalate";
}

export class IncidentDiagnoserService {
  public diagnose(
    errorRate: number,
    backlog: number,
    healthStatus: "healthy" | "degraded" | "failed" = "healthy",
  ): IncidentDiagnosis {
    const level = classifyOpsIncident(errorRate, backlog);
    const suspectedCauses: string[] = [];

    if (errorRate >= 0.2) {
      suspectedCauses.push("ops.incident.error_rate_spike");
    } else if (errorRate >= 0.05) {
      suspectedCauses.push("ops.incident.error_rate_regression");
    }

    if (backlog >= 1000) {
      suspectedCauses.push("ops.incident.backlog_saturation");
    } else if (backlog >= 200) {
      suspectedCauses.push("ops.incident.backlog_growth");
    }

    if (healthStatus !== "healthy") {
      suspectedCauses.push(`ops.incident.health_${healthStatus}`);
    }

    return {
      level,
      summary: summarizeIncidentDiagnosis(errorRate, backlog),
      suspectedCauses,
      recommendedAction: level === "critical_incident"
        ? "escalate"
        : level === "incident"
          ? "investigate"
          : "monitor",
    };
  }
}
