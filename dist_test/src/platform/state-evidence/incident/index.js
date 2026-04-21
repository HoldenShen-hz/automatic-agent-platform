import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class IncidentCaseService {
    incidents = new Map();
    incidentOrder = new Map();
    nextIncidentOrder = 1;
    openIncident(input) {
        const now = nowIso();
        const incident = {
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
    acknowledge(incidentId, owner) {
        const incident = this.getRequired(incidentId);
        return this.update(incidentId, { ...incident, status: "acknowledged", owner, updatedAt: nowIso() });
    }
    startMitigation(incidentId) {
        const incident = this.getRequired(incidentId);
        if (incident.status === "open") {
            throw new ValidationError("incident.must_acknowledge_before_mitigation", "Incident must be acknowledged before mitigation can begin.");
        }
        return this.update(incidentId, { ...incident, status: "mitigating", updatedAt: nowIso() });
    }
    resolve(incidentId) {
        const incident = this.getRequired(incidentId);
        const now = nowIso();
        return this.update(incidentId, { ...incident, status: "resolved", updatedAt: now, resolvedAt: now });
    }
    getIncident(incidentId) {
        return this.incidents.get(incidentId) ?? null;
    }
    listIncidents(limit = 50) {
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
    getRequired(incidentId) {
        const incident = this.getIncident(incidentId);
        if (incident == null) {
            throw new ValidationError(`incident.not_found:${incidentId}`, `Incident ${incidentId} was not found.`);
        }
        return incident;
    }
    update(incidentId, incident) {
        this.incidents.set(incidentId, incident);
        return incident;
    }
}
//# sourceMappingURL=index.js.map