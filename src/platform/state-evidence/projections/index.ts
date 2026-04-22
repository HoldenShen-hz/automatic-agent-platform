import { newId, nowIso } from "../../contracts/types/ids.js";

export interface ProjectionInputEvent {
  eventId: string;
  eventType: string;
  taskId: string | null;
  payloadJson: string;
  createdAt: string;
}

export interface ProjectionRecord {
  projectionId: string;
  sourceEventId: string;
  projectionName: string;
  entityRef: string;
  state: Record<string, unknown>;
  updatedAt: string;
}

export class EventProjectionService {
  private readonly projections = new Map<string, ProjectionRecord>();

  public applyEvent(event: ProjectionInputEvent): ProjectionRecord {
    const payload = safeParseObject(event.payloadJson);
    const projectionName = projectionNameForEvent(event.eventType);
    const entityRef = event.taskId ?? String(payload.entityRef ?? payload.taskId ?? event.eventId);
    const key = `${projectionName}:${entityRef}`;
    const previous = this.projections.get(key);
    const record: ProjectionRecord = {
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

  public getProjection(projectionName: string, entityRef: string): ProjectionRecord | null {
    return this.projections.get(`${projectionName}:${entityRef}`) ?? null;
  }

  public listProjections(): ProjectionRecord[] {
    return Array.from(this.projections.values());
  }
}

export {
  ProjectionRebuildService,
  ProjectionHandlerRegistry,
} from "./projection-rebuild-service.js";
export type {
  ProjectionRebuildResult,
  ProjectionRebuildOptions,
  ProjectionHandler,
} from "./projection-rebuild-service.js";

function projectionNameForEvent(eventType: string): string {
  if (eventType.startsWith("workflow:")) return "workflow_summary";
  if (eventType.startsWith("approval:")) return "approval_summary";
  if (eventType.startsWith("incident:")) return "incident_summary";
  return "event_summary";
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { value: parsed };
  } catch {
    return { raw };
  }
}
