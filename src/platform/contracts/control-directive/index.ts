import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export type ControlDirectiveKind = "pause" | "resume" | "cancel" | "rollback" | "escalate";

export interface ControlDirective {
  directiveId: string;
  kind: ControlDirectiveKind;
  targetRef: string;
  reasonCode: string;
  issuedBy: string;
  tenantId: string | null;
  executionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function createControlDirective(input: Omit<ControlDirective, "directiveId" | "createdAt"> & {
  directiveId?: string;
  createdAt?: string;
}): ControlDirective {
  assertRequired(input.targetRef, "control_directive.target_ref_required");
  assertRequired(input.reasonCode, "control_directive.reason_code_required");
  assertRequired(input.issuedBy, "control_directive.issued_by_required");
  return {
    directiveId: input.directiveId ?? newId("directive"),
    kind: input.kind,
    targetRef: input.targetRef,
    reasonCode: input.reasonCode,
    issuedBy: input.issuedBy,
    tenantId: input.tenantId ?? null,
    executionId: input.executionId ?? null,
    metadata: input.metadata,
    createdAt: input.createdAt ?? nowIso(),
  };
}

function assertRequired(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, "Control directive field is required.");
  }
}
