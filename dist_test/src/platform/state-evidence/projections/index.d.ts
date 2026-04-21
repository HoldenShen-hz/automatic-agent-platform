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
export declare class EventProjectionService {
    private readonly projections;
    applyEvent(event: ProjectionInputEvent): ProjectionRecord;
    getProjection(projectionName: string, entityRef: string): ProjectionRecord | null;
    listProjections(): ProjectionRecord[];
}
export { ProjectionRebuildService, ProjectionRebuildResult, ProjectionRebuildOptions, ProjectionHandler, ProjectionHandlerRegistry, } from "./projection-rebuild-service.js";
