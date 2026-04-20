import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export type StateCommandAction = "upsert" | "transition" | "append_event" | "delete";

export interface StateCommand {
  commandId: string;
  entityKind: string;
  entityId: string;
  action: StateCommandAction;
  expectedVersion: number | null;
  payload: Record<string, unknown>;
  emittedBy: string;
  createdAt: string;
}

export function createStateCommand(input: Omit<StateCommand, "commandId" | "createdAt"> & {
  commandId?: string;
  createdAt?: string;
}): StateCommand {
  if (input.entityKind.trim().length === 0 || input.entityId.trim().length === 0 || input.emittedBy.trim().length === 0) {
    throw new ValidationError("state_command.required_fields_missing", "State command requires entity kind, entity id, and emitter.");
  }
  if (input.action === "transition" && typeof input.payload.nextStatus !== "string") {
    throw new ValidationError("state_command.next_status_required", "Transition commands require payload.nextStatus.");
  }
  return {
    commandId: input.commandId ?? newId("statecmd"),
    entityKind: input.entityKind,
    entityId: input.entityId,
    action: input.action,
    expectedVersion: input.expectedVersion ?? null,
    payload: { ...input.payload },
    emittedBy: input.emittedBy,
    createdAt: input.createdAt ?? nowIso(),
  };
}
