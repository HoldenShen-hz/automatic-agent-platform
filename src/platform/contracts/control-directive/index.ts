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
  void input;
  void assertRequired;
  void newId;
  void nowIso;
  throw new ValidationError(
    "control_directive.legacy_contract_forbidden",
    "ControlDirective is deprecated. Use runtime decision or governance directives from executable-contracts instead.",
  );
}

function assertRequired(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, "Control directive field is required.");
  }
}
