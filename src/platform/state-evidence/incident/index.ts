import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

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

export class IncidentCaseService {
  private readonly incidents = new Map<string, IncidentCase>();

  public openIncident(input: {
    severity: IncidentSeverity;
    title: string;
    linkedEvidenceRefs?: string[];
  }): IncidentCase {
    const now = nowIso();
    const incident: IncidentCase = {
      incidentId: newId("incident"),
      severity: input.severity,
      status: "open",
      title: input.title,
      linkedEvidenceRefs: input.linkedEvidenceRefs ?? [],
      owner: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    this.incidents.set(incident.incidentId, incident);
    return incident;
  }

  public acknowledge(incidentId: string, owner: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    return this.update(incidentId, { ...incident, status: "acknowledged", owner, updatedAt: nowIso() });
  }

  public startMitigation(incidentId: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    if (incident.status === "open") {
      throw new ValidationError(
        "incident.must_acknowledge_before_mitigation",
        "Incident must be acknowledged before mitigation can begin.",
      );
    }
    return this.update(incidentId, { ...incident, status: "mitigating", updatedAt: nowIso() });
  }

  public resolve(incidentId: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    const now = nowIso();
    return this.update(incidentId, { ...incident, status: "resolved", updatedAt: now, resolvedAt: now });
  }

  public getIncident(incidentId: string): IncidentCase | null {
    return this.incidents.get(incidentId) ?? null;
  }

  private getRequired(incidentId: string): IncidentCase {
    const incident = this.getIncident(incidentId);
    if (incident == null) {
      throw new ValidationError(`incident.not_found:${incidentId}`, `Incident ${incidentId} was not found.`);
    }
    return incident;
  }

  private update(incidentId: string, incident: IncidentCase): IncidentCase {
    this.incidents.set(incidentId, incident);
    return incident;
  }
}
