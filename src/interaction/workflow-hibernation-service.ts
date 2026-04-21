import { nowIso } from "../platform/contracts/types/ids.js";

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

export class WorkflowHibernationService {
  private readonly records = new Map<string, WorkflowHibernationRecord>();

  public hibernate(workflowId: string, taskId: string, ttlHours = 24 * 7, now = nowIso()): WorkflowHibernationRecord {
    const normalizedTtlHours = Math.min(24 * 30, Math.max(1, Math.trunc(ttlHours)));
    const record: WorkflowHibernationRecord = {
      workflowId,
      taskId,
      status: "hibernated",
      hibernatedAt: now,
      expiresAt: new Date(new Date(now).getTime() + normalizedTtlHours * 3600 * 1000).toISOString(),
      heartbeatEvents: [],
    };
    this.records.set(workflowId, record);
    return record;
  }

  public emitStillHibernated(workflowId: string, emittedAt = nowIso()): WorkflowHibernationHealthEvent {
    const record = this.requireRecord(workflowId);
    if (record.status !== "hibernated") {
      throw new Error(`workflow_hibernation.not_hibernated:${workflowId}`);
    }
    this.records.set(workflowId, {
      ...record,
      heartbeatEvents: [...record.heartbeatEvents, emittedAt],
    });
    return {
      workflowId,
      eventType: "still_hibernated",
      emittedAt,
    };
  }

  public resume(workflowId: string, resumedAt = nowIso()): WorkflowHibernationHealthEvent {
    const record = this.requireRecord(workflowId);
    this.records.set(workflowId, {
      ...record,
      status: "resumed",
    });
    return {
      workflowId,
      eventType: "resumed",
      emittedAt: resumedAt,
    };
  }

  public getRecord(workflowId: string): WorkflowHibernationRecord | null {
    return this.records.get(workflowId) ?? null;
  }

  public emitDueStillHibernatedEvents(asOf = nowIso(), intervalHours = 24): WorkflowHibernationHealthEvent[] {
    const emittedAt = new Date(asOf);
    const intervalMs = Math.max(1, Math.trunc(intervalHours)) * 3600 * 1000;
    return [...this.records.values()]
      .filter((record) => record.status === "hibernated")
      .filter((record) => {
        const anchor = record.heartbeatEvents[record.heartbeatEvents.length - 1] ?? record.hibernatedAt;
        if (anchor == null) {
          return false;
        }
        return emittedAt.getTime() - new Date(anchor).getTime() >= intervalMs;
      })
      .map((record) => this.emitStillHibernated(record.workflowId, asOf));
  }

  private requireRecord(workflowId: string): WorkflowHibernationRecord {
    const record = this.records.get(workflowId);
    if (record == null) {
      throw new Error(`workflow_hibernation.not_found:${workflowId}`);
    }
    return record;
  }
}
