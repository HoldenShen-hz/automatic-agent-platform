import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "triaged" | "mitigating" | "reviewed" | "resolved" | "closed";

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
  private readonly incidentOrder = new Map<string, bigint>();

  private encodeCursor(incident: IncidentCase): string {
    return Buffer.from(JSON.stringify({
      createdAt: incident.createdAt,
      incidentId: incident.incidentId,
      sortOrder: (this.incidentOrder.get(incident.incidentId) ?? 0n).toString(),
    }), "utf8").toString("base64url");
  }

  private decodeCursor(cursor: string): { createdAt: string; incidentId: string; sortOrder: bigint } | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
        createdAt?: unknown;
        incidentId?: unknown;
        sortOrder?: unknown;
      };
      if (typeof parsed.createdAt !== "string" || typeof parsed.incidentId !== "string" || typeof parsed.sortOrder !== "string") {
        return null;
      }
      return { createdAt: parsed.createdAt, incidentId: parsed.incidentId, sortOrder: BigInt(parsed.sortOrder) };
    } catch {
      return null;
    }
  }

  private compareIncidents(left: IncidentCase, right: IncidentCase): number {
    const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
    if (createdAtOrder !== 0) {
      return createdAtOrder;
    }
    const leftOrder = this.incidentOrder.get(left.incidentId) ?? 0n;
    const rightOrder = this.incidentOrder.get(right.incidentId) ?? 0n;
    if (leftOrder !== rightOrder) {
      return rightOrder > leftOrder ? 1 : -1;
    }
    return right.incidentId.localeCompare(left.incidentId);
  }

  private getSortedIncidents(): IncidentCase[] {
    return [...this.incidents.values()].sort((left, right) => this.compareIncidents(left, right));
  }

  public openIncident(input: {
    severity: IncidentSeverity;
    title: string;
    linkedEvidenceRefs?: string[];
    tenantId?: string | null;
  }): IncidentCase {
    const now = nowIso();
    const incident: IncidentCase = {
      incidentId: newId("incident"),
      tenantId: input.tenantId ?? null,
      severity: input.severity,
      status: "open",
      title: input.title,
      linkedEvidenceRefs: [...(input.linkedEvidenceRefs ?? [])],
      owner: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    this.incidents.set(incident.incidentId, incident);
    this.incidentOrder.set(incident.incidentId, process.hrtime.bigint());
    return incident;
  }

  /**
   * Transitions incident to triaged status with an assigned owner.
   * §R14-03: Triaged state for incident lifecycle.
   */
  public triage(incidentId: string, owner: string, tenantId?: string | null): IncidentCase {
    const incident = this.getRequired(incidentId, tenantId);
    if (incident.status !== "open") {
      throw new ValidationError(
        "incident.must_be_open_for_triage",
        "Incident must be in open state before it can be triaged.",
      );
    }
    return this.update(incidentId, { ...incident, status: "triaged", owner, updatedAt: nowIso() });
  }

  /**
   * Backward-compatible acknowledgement transition used by the HTTP facade.
   */
  public acknowledge(incidentId: string, owner: string, tenantId?: string | null): IncidentCase {
    const incident = this.getRequired(incidentId, tenantId);
    if (incident.status !== "open") {
      throw new ValidationError(
        "incident.must_be_open_for_acknowledge",
        "Incident must be in open state before it can be acknowledged.",
      );
    }
    return this.update(incidentId, { ...incident, status: "acknowledged", owner, updatedAt: nowIso() });
  }

  public startMitigation(incidentId: string, tenantId?: string | null): IncidentCase {
    const incident = this.getRequired(incidentId, tenantId);
    if (incident.status !== "acknowledged" && incident.status !== "triaged") {
      throw new ValidationError(
        "incident.must_be_acknowledged_for_mitigation",
        "Incident must be acknowledged before mitigation can start.",
      );
    }
    return this.update(incidentId, { ...incident, status: "mitigating", updatedAt: nowIso() });
  }

  /**
   * Transitions incident to reviewed status after mitigation.
   * §R14-03: Reviewed state for incident lifecycle.
   */
  public review(incidentId: string, tenantId?: string | null): IncidentCase {
    const incident = this.getRequired(incidentId, tenantId);
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
  public close(incidentId: string, tenantId?: string | null): IncidentCase {
    const incident = this.getRequired(incidentId, tenantId);
    if (incident.status !== "reviewed" && incident.status !== "resolved") {
      throw new ValidationError(
        "incident.must_be_resolved_for_closure",
        "Incident must be in reviewed or resolved state before it can be closed.",
      );
    }
    const now = nowIso();
    return this.update(incidentId, { ...incident, status: "closed", updatedAt: now });
  }

  public resolve(incidentId: string, tenantId?: string | null): IncidentCase {
    const incident = this.getRequired(incidentId, tenantId);
    if (incident.status !== "reviewed") {
      throw new ValidationError(
        "incident.must_be_reviewed_for_resolution",
        "Incident must be in reviewed state before it can be resolved.",
      );
    }
    const now = nowIso();
    return this.update(incidentId, { ...incident, status: "resolved", updatedAt: now, resolvedAt: now });
  }

  public getIncident(incidentId: string, tenantId?: string | null): IncidentCase | null {
    const incident = this.incidents.get(incidentId) ?? null;
    if (incident == null) {
      return null;
    }
    if (tenantId != null && incident.tenantId !== tenantId) {
      return null;
    }
    return incident;
  }

  public listIncidents(limit = 50, tenantId?: string | null): IncidentCase[] {
    return this.getSortedIncidents()
      .filter((incident) => tenantId == null || incident.tenantId === tenantId)
      .slice(0, Math.max(0, limit));
  }

  // R20-30: Cursor-based pagination for incidents
  public listIncidentsPaginated(limit = 50, tenantId?: string | null, cursor?: string | null): { incidents: IncidentCase[]; nextToken: string | null } {
    const sorted = this.getSortedIncidents().filter((incident) => tenantId == null || incident.tenantId === tenantId);

    let startIndex = 0;
    if (cursor != null) {
      const decodedCursor = this.decodeCursor(cursor);
      if (decodedCursor != null) {
        startIndex = sorted.findIndex((incident) =>
          incident.createdAt < decodedCursor.createdAt
          || (
            incident.createdAt === decodedCursor.createdAt
            && (this.incidentOrder.get(incident.incidentId) ?? 0n) < decodedCursor.sortOrder
          )
        );
        if (startIndex < 0) {
          startIndex = sorted.length;
        }
      }
    }

    const page = sorted.slice(startIndex, startIndex + Math.max(0, limit));
    const nextToken = startIndex + limit < sorted.length && page.length > 0
      ? this.encodeCursor(page[page.length - 1]!)
      : null;
    return { incidents: page, nextToken };
  }

  private getRequired(incidentId: string, tenantId?: string | null): IncidentCase {
    const incident = this.getIncident(incidentId, tenantId);
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
