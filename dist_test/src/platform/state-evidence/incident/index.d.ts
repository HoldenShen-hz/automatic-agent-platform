export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "mitigating" | "resolved";
export interface IncidentCase {
    incidentId: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    title: string;
    linkedEvidenceRefs: string[];
    owner: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
}
export declare class IncidentCaseService {
    private readonly incidents;
    private readonly incidentOrder;
    private nextIncidentOrder;
    openIncident(input: {
        severity: IncidentSeverity;
        title: string;
        linkedEvidenceRefs?: string[];
    }): IncidentCase;
    acknowledge(incidentId: string, owner: string): IncidentCase;
    startMitigation(incidentId: string): IncidentCase;
    resolve(incidentId: string): IncidentCase;
    getIncident(incidentId: string): IncidentCase | null;
    listIncidents(limit?: number): IncidentCase[];
    private getRequired;
    private update;
}
