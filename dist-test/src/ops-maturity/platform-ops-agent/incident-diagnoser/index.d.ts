export declare function classifyOpsIncident(errorRate: number, backlog: number): "warning" | "incident" | "critical_incident";
export declare function summarizeIncidentDiagnosis(errorRate: number, backlog: number): string;
export interface IncidentDiagnosis {
    readonly level: "warning" | "incident" | "critical_incident";
    readonly summary: string;
    readonly suspectedCauses: readonly string[];
    readonly recommendedAction: "monitor" | "investigate" | "escalate";
}
export declare class IncidentDiagnoserService {
    diagnose(errorRate: number, backlog: number, healthStatus?: "healthy" | "degraded" | "failed"): IncidentDiagnosis;
}
