import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "triaged" | "mitigating" | "reviewed" | "resolved" | "closed";

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
  private readonly incidentOrder = new Map<string, number>();
  private nextIncidentOrder = 1;

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
    this.incidentOrder.set(incident.incidentId, this.nextIncidentOrder++);
    return incident;
  }

  /**
   * Transitions incident to triaged status with an assigned owner.
   * §R14-03: Triaged state for incident lifecycle.
   */
  public triage(incidentId: string, owner: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    if (incident.status !== "open") {
      throw new ValidationError(
        "incident.must_be_open_for_triage",
        "Incident must be in open state before it can be triaged.",
      );
    }
    return this.update(incidentId, { ...incident, status: "triaged", owner, updatedAt: nowIso() });
  }

  /**
   * Transitions incident to reviewed status after mitigation.
   * §R14-03: Reviewed state for incident lifecycle.
   */
  public review(incidentId: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    if (incident.status !== "mitigating") {
      throw new ValidationError(
        "incident.must_be_mitigating_for_review",
        "Incident must be in mitigating state before it can be reviewed.",
      );
    }
    return this.update(incidentId, { ...incident, status: "reviewed", updatedAt: nowIso() });
  }

  /**
   * Closes a resolved incident.
   * §R14-03: Closed state completes the incident lifecycle.
   */
  public close(incidentId: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    if (incident.status !== "reviewed" && incident.status !== "resolved") {
      throw new ValidationError(
        "incident.must_be_resolved_for_closure",
        "Incident must be in reviewed or resolved state before it can be closed.",
      );
    }
    const now = nowIso();
    return this.update(incidentId, { ...incident, status: "closed", updatedAt: now });
  }

  public resolve(incidentId: string): IncidentCase {
    const incident = this.getRequired(incidentId);
    const now = nowIso();
    return this.update(incidentId, { ...incident, status: "resolved", updatedAt: now, resolvedAt: now });
  }

  public getIncident(incidentId: string): IncidentCase | null {
    return this.incidents.get(incidentId) ?? null;
  }

  public listIncidents(limit = 50): IncidentCase[] {
    return [...this.incidents.values()]
      .sort((left, right) => {
        const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }
        return (this.incidentOrder.get(right.incidentId) ?? 0) - (this.incidentOrder.get(left.incidentId) ?? 0);
      })
      .slice(0, Math.max(0, limit));
  }

  // R20-30: Cursor-based pagination for incidents
  public listIncidentsPaginated(limit = 50, cursor?: string | null): { incidents: IncidentCase[]; nextToken: string | null } {
    const sorted = [...this.incidents.values()]
      .sort((left, right) => {
        const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }
        return (this.incidentOrder.get(right.incidentId) ?? 0) - (this.incidentOrder.get(left.incidentId) ?? 0);
      });

    let startIndex = 0;
    if (cursor != null) {
      const cursorIndex = sorted.findIndex((incident) => incident.incidentId === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const page = sorted.slice(startIndex, startIndex + Math.max(0, limit));
    const nextToken = startIndex + limit < sorted.length ? page[page.length - 1]?.incidentId ?? null : null;
    return { incidents: page, nextToken };
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
