export interface WorkflowHibernationRecord {
    readonly workflowId: string;
    readonly taskId: string;
    readonly status: "active" | "hibernated" | "resumed";
    readonly hibernatedAt: string | null;
    readonly expiresAt: string | null;
    readonly heartbeatEvents: readonly string[];
}
export interface WorkflowHibernationHealthEvent {
    readonly workflowId: string;
    readonly eventType: "still_hibernated" | "resumed";
    readonly emittedAt: string;
}
export declare class WorkflowHibernationService {
    private readonly records;
    hibernate(workflowId: string, taskId: string, ttlHours?: number, now?: string): WorkflowHibernationRecord;
    emitStillHibernated(workflowId: string, emittedAt?: string): WorkflowHibernationHealthEvent;
    resume(workflowId: string, resumedAt?: string): WorkflowHibernationHealthEvent;
    getRecord(workflowId: string): WorkflowHibernationRecord | null;
    emitDueStillHibernatedEvents(asOf?: string, intervalHours?: number): WorkflowHibernationHealthEvent[];
    private requireRecord;
}
