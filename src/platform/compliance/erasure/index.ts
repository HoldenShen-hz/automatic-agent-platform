import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type ErasureTargetKind = "task" | "message" | "artifact" | "memory" | "backup";
export type ErasureAction = "erase" | "redact" | "hold" | "skip";

export interface ErasureTarget {
  targetRef: string;
  targetKind: ErasureTargetKind;
  containsPii: boolean;
  legalHold?: boolean;
  backupCopy?: boolean;
}

export interface ErasurePlanStep {
  targetRef: string;
  targetKind: ErasureTargetKind;
  action: ErasureAction;
  reason: string;
}

export interface ErasurePlan {
  requestId: string;
  subjectRef: string;
  requestedBy: string;
  dueAt: string;
  status: "planned" | "blocked_by_legal_hold" | "ready";
  steps: ErasurePlanStep[];
  createdAt: string;
}

export class ErasurePlanningService {
  public createPlan(input: {
    subjectRef: string;
    requestedBy: string;
    targets: ErasureTarget[];
    slaHours: number;
  }): ErasurePlan {
    if (!Number.isFinite(input.slaHours) || input.slaHours <= 0) {
      throw new ValidationError("erasure.invalid_sla", "Erasure SLA hours must be a positive finite number.");
    }
    const createdAt = nowIso();
    const dueAt = new Date(Date.parse(createdAt) + input.slaHours * 60 * 60 * 1000).toISOString();
    const steps = input.targets.map((target): ErasurePlanStep => {
      if (target.legalHold) {
        return { targetRef: target.targetRef, targetKind: target.targetKind, action: "hold", reason: "legal_hold" };
      }
      if (target.backupCopy) {
        return { targetRef: target.targetRef, targetKind: target.targetKind, action: "redact", reason: "backup_copy_redaction" };
      }
      if (target.containsPii) {
        return { targetRef: target.targetRef, targetKind: target.targetKind, action: "erase", reason: "pii_subject_request" };
      }
      return { targetRef: target.targetRef, targetKind: target.targetKind, action: "skip", reason: "no_pii" };
    });
    const blocked = steps.some((step) => step.action === "hold");
    return {
      requestId: newId("erase"),
      subjectRef: input.subjectRef,
      requestedBy: input.requestedBy,
      dueAt,
      status: blocked ? "blocked_by_legal_hold" : "ready",
      steps,
      createdAt,
    };
  }
}
