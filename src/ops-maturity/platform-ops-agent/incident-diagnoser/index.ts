export function classifyOpsIncident(errorRate: number, backlog: number): "warning" | "incident" | "critical_incident" {
  if (errorRate >= 0.2 || backlog >= 1000) return "critical_incident";
  if (errorRate >= 0.05 || backlog >= 200) return "incident";
  return "warning";
}

export function summarizeIncidentDiagnosis(errorRate: number, backlog: number): string {
  return `${classifyOpsIncident(errorRate, backlog)}: errorRate=${errorRate}, backlog=${backlog}`;
}
