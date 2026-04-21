import { newId, nowIso } from "../../contracts/types/ids.js";
export class EventProjectionService {
    projections = new Map();
    applyEvent(event) {
        const payload = safeParseObject(event.payloadJson);
        const projectionName = projectionNameForEvent(event.eventType);
        const entityRef = event.taskId ?? String(payload.entityRef ?? payload.taskId ?? event.eventId);
        const key = `${projectionName}:${entityRef}`;
        const previous = this.projections.get(key);
        const record = {
            projectionId: previous?.projectionId ?? newId("projection"),
            sourceEventId: event.eventId,
            projectionName,
            entityRef,
            state: {
                ...(previous?.state ?? {}),
                eventType: event.eventType,
                lastPayload: payload,
                lastEventAt: event.createdAt,
            },
            updatedAt: nowIso(),
        };
        this.projections.set(key, record);
        return record;
    }
    getProjection(projectionName, entityRef) {
        return this.projections.get(`${projectionName}:${entityRef}`) ?? null;
    }
    listProjections() {
        return Array.from(this.projections.values());
    }
}
export { ProjectionRebuildService, ProjectionHandlerRegistry, } from "./projection-rebuild-service.js";
function projectionNameForEvent(eventType) {
    if (eventType.startsWith("workflow:"))
        return "workflow_summary";
    if (eventType.startsWith("approval:"))
        return "approval_summary";
    if (eventType.startsWith("incident:"))
        return "incident_summary";
    return "event_summary";
}
function safeParseObject(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : { value: parsed };
    }
    catch {
        return { raw };
    }
}
//# sourceMappingURL=index.js.map