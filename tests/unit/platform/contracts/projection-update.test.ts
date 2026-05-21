/**
 * Tests for src/platform/contracts/projection-update/index.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  createProjectionUpdate,
  validateProjectionUpdate,
  type ProjectionUpdate,
  type CreateProjectionUpdateInput,
} from "../../../../src/platform/contracts/projection-update/index.js";

describe("contracts/projection-update", () => {
  describe("createProjectionUpdate", () => {
    it("should create a valid projection update", () => {
      const input: CreateProjectionUpdateInput = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        sourceEvents: ["event-1", "event-2"],
        patch: { status: "completed" },
        triggeredBy: "test-trigger",
      };
      const result = createProjectionUpdate(input);
      assert.strictEqual(result.projectionId, "proj-1");
      assert.strictEqual(result.projectionType, "task-projection");
      assert.strictEqual(result.version, 1);
      assert.deepStrictEqual(result.sourceEvents, ["event-1", "event-2"]);
      assert.deepStrictEqual(result.patch, { status: "completed" });
      assert.strictEqual(result.metadata.triggeredBy, "test-trigger");
      assert.ok(result.timestamp);
      assert.ok(result.metadata.idempotencyKey);
    });

    it("should throw ValidationError when projectionId is empty", () => {
      const input = {
        projectionId: "  ",
        projectionType: "task-projection",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
      };
      assert.throws(
        () => createProjectionUpdate(input as CreateProjectionUpdateInput),
        /projection_update.projection_id_required/,
      );
    });

    it("should throw ValidationError when projectionType is empty", () => {
      const input = {
        projectionId: "proj-1",
        projectionType: "",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
      };
      assert.throws(
        () => createProjectionUpdate(input as CreateProjectionUpdateInput),
        /projection_update.projection_type_required/,
      );
    });

    it("should throw ValidationError when triggeredBy is empty", () => {
      const input = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "",
      };
      assert.throws(
        () => createProjectionUpdate(input as CreateProjectionUpdateInput),
        /projection_update.triggered_by_required/,
      );
    });

    it("should throw ValidationError when version is negative", () => {
      const input = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: -1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
      };
      assert.throws(
        () => createProjectionUpdate(input as CreateProjectionUpdateInput),
        /projection_update.invalid_version/,
      );
    });

    it("should throw ValidationError when version is not an integer", () => {
      const input = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1.5,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
      };
      assert.throws(
        () => createProjectionUpdate(input as CreateProjectionUpdateInput),
        /projection_update.invalid_version/,
      );
    });

    it("should use provided timestamp when given", () => {
      const input: CreateProjectionUpdateInput = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
        timestamp: "2024-01-01T00:00:00Z",
      };
      const result = createProjectionUpdate(input);
      assert.strictEqual(result.timestamp, "2024-01-01T00:00:00Z");
    });

    it("should use provided idempotencyKey when given", () => {
      const input: CreateProjectionUpdateInput = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
        idempotencyKey: "idem-123",
      };
      const result = createProjectionUpdate(input);
      assert.strictEqual(result.metadata.idempotencyKey, "idem-123");
    });

    it("should include rebuiltAt when provided", () => {
      const input: CreateProjectionUpdateInput = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test-trigger",
        rebuiltAt: "2024-01-01T00:00:00Z",
      };
      const result = createProjectionUpdate(input);
      assert.strictEqual(result.metadata.rebuiltAt, "2024-01-01T00:00:00Z");
    });
  });

  describe("validateProjectionUpdate", () => {
    it("should return the update when valid", () => {
      const update: ProjectionUpdate = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        timestamp: "2024-01-01T00:00:00Z",
        sourceEvents: ["event-1"],
        patch: { status: "done" },
        metadata: {
          triggeredBy: "test-trigger",
          idempotencyKey: "idem-1",
        },
      };
      const result = validateProjectionUpdate(update);
      assert.strictEqual(result, update);
    });

    it("should throw ValidationError when projectionId is empty", () => {
      const update: ProjectionUpdate = {
        projectionId: "",
        projectionType: "task-projection",
        version: 1,
        timestamp: "2024-01-01T00:00:00Z",
        sourceEvents: [],
        patch: {},
        metadata: {
          triggeredBy: "test-trigger",
          idempotencyKey: "idem-1",
        },
      };
      assert.throws(
        () => validateProjectionUpdate(update),
        /projection_update.projection_id_required/,
      );
    });

    it("should throw ValidationError when idempotencyKey is empty", () => {
      const update: ProjectionUpdate = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: 1,
        timestamp: "2024-01-01T00:00:00Z",
        sourceEvents: [],
        patch: {},
        metadata: {
          triggeredBy: "test-trigger",
          idempotencyKey: "   ",
        },
      };
      assert.throws(
        () => validateProjectionUpdate(update),
        /projection_update.idempotency_key_required/,
      );
    });

    it("should throw ValidationError when version is negative", () => {
      const update: ProjectionUpdate = {
        projectionId: "proj-1",
        projectionType: "task-projection",
        version: -5,
        timestamp: "2024-01-01T00:00:00Z",
        sourceEvents: [],
        patch: {},
        metadata: {
          triggeredBy: "test-trigger",
          idempotencyKey: "idem-1",
        },
      };
      assert.throws(
        () => validateProjectionUpdate(update),
        /projection_update.invalid_version/,
      );
    });
  });
});