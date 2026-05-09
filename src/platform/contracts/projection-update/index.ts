import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export interface ProjectionUpdate {
  readonly projectionId: string;
  readonly projectionType: string;
  readonly version: number;
  readonly timestamp: string;
  readonly sourceEvents: readonly string[];
  readonly patch: Readonly<Record<string, unknown>>;
  readonly metadata: {
    readonly rebuiltAt?: string | undefined;
    readonly triggeredBy: string;
    readonly idempotencyKey: string;
  };
}

export interface CreateProjectionUpdateInput {
  readonly projectionId: string;
  readonly projectionType: string;
  readonly version: number;
  readonly sourceEvents: readonly string[];
  readonly patch: Readonly<Record<string, unknown>>;
  readonly triggeredBy: string;
  readonly rebuiltAt?: string;
  readonly idempotencyKey?: string;
  readonly timestamp?: string;
}

export function createProjectionUpdate(input: CreateProjectionUpdateInput): ProjectionUpdate {
  assertNonEmpty(input.projectionId, "projection_update.projection_id_required", "Projection update requires a projectionId.");
  assertNonEmpty(input.projectionType, "projection_update.projection_type_required", "Projection update requires a projectionType.");
  assertNonEmpty(input.triggeredBy, "projection_update.triggered_by_required", "Projection update requires a triggeredBy actor.");
  assertValidVersion(input.version);

  return {
    projectionId: input.projectionId,
    projectionType: input.projectionType,
    version: input.version,
    timestamp: input.timestamp ?? nowIso(),
    sourceEvents: [...input.sourceEvents],
    patch: { ...input.patch },
    metadata: {
      ...(input.rebuiltAt != null ? { rebuiltAt: input.rebuiltAt } : {}),
      triggeredBy: input.triggeredBy,
      idempotencyKey: input.idempotencyKey ?? newId("projupd"),
    },
  };
}

export function validateProjectionUpdate(update: ProjectionUpdate): ProjectionUpdate {
  assertNonEmpty(update.projectionId, "projection_update.projection_id_required", "Projection update requires a projectionId.");
  assertNonEmpty(update.projectionType, "projection_update.projection_type_required", "Projection update requires a projectionType.");
  assertNonEmpty(update.metadata.triggeredBy, "projection_update.triggered_by_required", "Projection update requires a triggeredBy actor.");
  assertNonEmpty(
    update.metadata.idempotencyKey,
    "projection_update.idempotency_key_required",
    "Projection update requires an idempotencyKey.",
  );
  assertValidVersion(update.version);
  return update;
}

function assertNonEmpty(value: string, code: string, message: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, message);
  }
}

function assertValidVersion(version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new ValidationError(
      "projection_update.invalid_version",
      "Projection update version must be a non-negative integer.",
    );
  }
}
