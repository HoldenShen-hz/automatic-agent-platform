import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { UnifiedSeverity } from "../../contracts/types/unified-severity.js";

export type IncidentSeverity = UnifiedSeverity;
export type IncidentStatus = "open" | "acknowledged" | "mitigating" | "resolved" | "dismissed";

export interface IncidentCase {
  incidentId: string;
  tenantId: string | null;
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
    tenantId: string | null;
    severity: IncidentSeverity;
    title: string;
    linkedEvidenceRefs?: string[];
  }): IncidentCase {
    const now = nowIso();
    const incident: IncidentCase = {
      incidentId: newId("incident"),
      tenantId: input.tenantId,
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

  public acknowledge(tenantId: string | undefined, incidentId: string, owner: string): IncidentCase {
    // R14-17: Enforce tenant scoping when acknowledging an incident
    const incident = this.getRequired(tenantId, incidentId);
    return this.update(incidentId, { ...incident, status: "acknowledged", owner, updatedAt: nowIso() });
  }

  public startMitigation(tenantId: string | undefined, incidentId: string): IncidentCase {
    // R14-17: Enforce tenant scoping when starting mitigation
    const incident = this.getRequired(tenantId, incidentId);
    if (incident.status === "open") {
      throw new ValidationError(
        "incident.must_acknowledge_before_mitigation",
        "Incident must be acknowledged before mitigation can begin.",
      );
    }
    return this.update(incidentId, { ...incident, status: "mitigating", updatedAt: nowIso() });
  }

  public resolve(tenantId: string | undefined, incidentId: string): IncidentCase {
    // R14-17: Enforce tenant scoping when resolving an incident
    const incident = this.getRequired(tenantId, incidentId);
    const now = nowIso();
    return this.update(incidentId, { ...incident, status: "resolved", updatedAt: now, resolvedAt: now });
  }

  // R14-24: dismiss action for incidents alongside acknowledge
  public dismiss(tenantId: string | undefined, incidentId: string, reason?: string): IncidentCase {
    const incident = this.getRequired(tenantId, incidentId);
    return this.update(incidentId, {
      ...incident,
      status: "dismissed",
      owner: null,
      updatedAt: nowIso(),
    });
  }

  public getIncident(tenantId: string | undefined, incidentId: string): IncidentCase | null {
    const incident = this.incidents.get(incidentId) ?? null;
    if (incident == null) {
      return null;
    }
    // R14-17: Enforce tenant scoping - only return incident if it belongs to the tenant scope
    if (tenantId != null && incident.tenantId !== tenantId) {
      return null;
    }
    return incident;
  }

  public listIncidents(tenantId: string | undefined, limit = 50): IncidentCase[] {
    // R14-23: Priority sorting - SEV1 (highest priority) first, then by createdAt
    const severityPriority: Record<IncidentSeverity, number> = {
      SEV1: 1,
      SEV2: 2,
      SEV3: 3,
      SEV4: 4,
    };
    return this.filterIncidentsByTenant(tenantId)
      .sort((left, right) => {
        // First sort by severity priority (SEV1 before SEV2 before SEV3 before SEV4)
        const severityDiff = severityPriority[left.severity] - severityPriority[right.severity];
        if (severityDiff !== 0) {
          return severityDiff;
        }
        // Then by createdAt descending (newest first)
        const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }
        return (this.incidentOrder.get(right.incidentId) ?? 0) - (this.incidentOrder.get(left.incidentId) ?? 0);
      })
      .slice(0, Math.max(0, limit));
  }

  public countIncidents(tenantId: string | undefined): number {
    return this.filterIncidentsByTenant(tenantId).length;
  }

  private getRequired(tenantId: string | undefined, incidentId: string): IncidentCase {
    const incident = this.getIncident(tenantId, incidentId);
    if (incident == null) {
      throw new ValidationError(`incident.not_found:${incidentId}`, `Incident ${incidentId} was not found.`);
    }
    return incident;
  }

  private update(incidentId: string, incident: IncidentCase): IncidentCase {
    this.incidents.set(incidentId, incident);
    return incident;
  }

  private filterIncidentsByTenant(tenantId: string | undefined): IncidentCase[] {
    return [...this.incidents.values()]
      .filter((incident) => tenantId == null || incident.tenantId === tenantId);
  }
}
