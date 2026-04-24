import assert from "node:assert/strict";
import test from "node:test";

import { createProjectionUpdate } from "../../../../../src/platform/contracts/projection-update/index.js";
import type { ProjectionUpdate } from "../../../../../src/platform/contracts/projection-update/index.js";

// =============================================================================
// Mock ProjectionApplier for testing
// =============================================================================

interface ProjectionState {
  data: Record<string, unknown>;
  version: number;
}

interface ApplyResult {
  success: boolean;
  newState: ProjectionState;
  versionBump: number;
}

interface ProjectionApplier {
  apply(update: ProjectionUpdate, currentState: ProjectionState): ApplyResult;
  canApply(update: ProjectionUpdate, currentState: ProjectionState): boolean;
}

// Mock applier implementation for testing
function createProjectionApplier(): ProjectionApplier {
  return {
    apply(update, currentState) {
      if (update.version !== currentState.version + 1) {
        return {
          success: false,
          newState: currentState,
          versionBump: 0,
        };
      }

      const newData = { ...currentState.data, ...update.patch };
      return {
        success: true,
        newState: {
          data: newData,
          version: update.version,
        },
        versionBump: 1,
      };
    },

    canApply(update, currentState) {
      return update.version === currentState.version + 1;
    },
  };
}

// =============================================================================
// ProjectionApplier Tests
// =============================================================================

test("ProjectionApplier.apply succeeds when version matches", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-applier-1",
    projectionType: "test-applier",
    version: 1,
    sourceEvents: ["evt-1"],
    patch: { field: "value1" },
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: { existing: "data" },
    version: 0,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, true);
  assert.equal(result.newState.version, 1);
  assert.equal(result.newState.data.field, "value1");
  assert.equal(result.newState.data.existing, "data");
  assert.equal(result.versionBump, 1);
});

test("ProjectionApplier.apply fails when version is out of order", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-applier-2",
    projectionType: "test-applier",
    version: 5,
    sourceEvents: ["evt-1"],
    patch: { field: "value5" },
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 0,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, false);
  assert.deepEqual(result.newState, currentState);
  assert.equal(result.versionBump, 0);
});

test("ProjectionApplier.apply merges patch into existing state", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-merge",
    projectionType: "merge-test",
    version: 1,
    sourceEvents: ["evt-1"],
    patch: { added: "field", counter: 42 },
    triggeredBy: "merge-tester",
  });

  const currentState: ProjectionState = {
    data: { existing: "kept" },
    version: 0,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, true);
  assert.equal(result.newState.data.existing, "kept");
  assert.equal(result.newState.data.added, "field");
  assert.equal(result.newState.data.counter, 42);
});

test("ProjectionApplier.canApply returns true for sequential version", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-canapply",
    projectionType: "test",
    version: 3,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 2,
  };

  assert.equal(applier.canApply(update, currentState), true);
});

test("ProjectionApplier.canApply returns false for non-sequential version", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-cannot",
    projectionType: "test",
    version: 10,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 5,
  };

  assert.equal(applier.canApply(update, currentState), false);
});

test("ProjectionApplier handles consecutive updates in sequence", () => {
  const applier = createProjectionApplier();

  const state1: ProjectionState = { data: {}, version: 0 };
  const update1 = createProjectionUpdate({
    projectionId: "proj-seq",
    projectionType: "sequential",
    version: 1,
    sourceEvents: ["evt-1"],
    patch: { step: 1 },
    triggeredBy: "seq-test",
  });

  const result1 = applier.apply(update1, state1);
  assert.equal(result1.success, true);
  assert.equal(result1.newState.version, 1);

  const update2 = createProjectionUpdate({
    projectionId: "proj-seq",
    projectionType: "sequential",
    version: 2,
    sourceEvents: ["evt-2"],
    patch: { step: 2 },
    triggeredBy: "seq-test",
  });

  const result2 = applier.apply(update2, result1.newState);
  assert.equal(result2.success, true);
  assert.equal(result2.newState.version, 2);
  assert.equal((result2.newState.data as { step: number }).step, 2);

  const update3 = createProjectionUpdate({
    projectionId: "proj-seq",
    projectionType: "sequential",
    version: 3,
    sourceEvents: ["evt-3"],
    patch: { step: 3 },
    triggeredBy: "seq-test",
  });

  const result3 = applier.apply(update3, result2.newState);
  assert.equal(result3.success, true);
  assert.equal(result3.newState.version, 3);
});

test("ProjectionApplier.apply handles empty patch", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-empty-patch",
    projectionType: "empty-test",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: { preserved: "yes" },
    version: 0,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, true);
  assert.equal(result.newState.data.preserved, "yes");
  assert.deepEqual(Object.keys(result.newState.data), ["preserved"]);
});

test("ProjectionApplier.apply handles complex nested patch", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-nested",
    projectionType: "nested-test",
    version: 1,
    sourceEvents: ["evt-nested"],
    patch: {
      user: { name: "Test User", scores: [10, 20, 30] },
      metadata: { active: true },
    },
    triggeredBy: "nested-tester",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 0,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, true);
  const userData = result.newState.data.user as { name: string; scores: number[] };
  assert.equal(userData.name, "Test User");
  assert.deepEqual(userData.scores, [10, 20, 30]);
  assert.equal((result.newState.data.metadata as { active: boolean }).active, true);
});

test("ProjectionApplier.canApply returns false when currentState is ahead", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-ahead",
    projectionType: "test",
    version: 5,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 10,
  };

  assert.equal(applier.canApply(update, currentState), false);
});

test("ProjectionApplier.apply preserves idempotencyKey from update", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-idempotency",
    projectionType: "idempotent-test",
    version: 1,
    sourceEvents: ["evt-1"],
    patch: { key: "value" },
    triggeredBy: "idempotency-tester",
    idempotencyKey: "idempotent-key-123",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 0,
  };

  // The applier itself doesn't use idempotencyKey, but the test verifies
  // the update structure is correct for applier consumption
  assert.equal(update.metadata.idempotencyKey, "idempotent-key-123");

  const result = applier.apply(update, currentState);
  assert.equal(result.success, true);
});

test("ProjectionApplier.apply with rebuiltAt update", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-rebuilt",
    projectionType: "rebuilt-test",
    version: 1,
    sourceEvents: [],
    patch: { rebuilt: true, data: "new" },
    triggeredBy: "rebuilder",
    rebuiltAt: "2026-04-24T00:00:00.000Z",
  });

  const currentState: ProjectionState = {
    data: { old: "data" },
    version: 0,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, true);
  assert.equal(result.newState.data.rebuilt, true);
  assert.equal(result.newState.data.data, "new");
  assert.equal(result.newState.data.old, "data");
});

test("ProjectionApplier can be used to build up state incrementally", () => {
  const applier = createProjectionApplier();

  let state: ProjectionState = { data: {}, version: 0 };
  const updates = [
    { step: 1, data: { counter: 1 } },
    { step: 2, data: { counter: 2 } },
    { step: 3, data: { counter: 3 } },
    { step: 4, data: { counter: 4 } },
    { step: 5, data: { counter: 5 } },
  ];

  for (let i = 0; i < updates.length; i++) {
    const update = createProjectionUpdate({
      projectionId: "proj-incremental",
      projectionType: "incremental-test",
      version: i + 1,
      sourceEvents: [`evt-step-${i + 1}`],
      patch: updates[i]!.data,
      triggeredBy: "incremental-tester",
    });

    const result = applier.apply(update, state);
    assert.equal(result.success, true, `Step ${i + 1} should succeed`);
    assert.equal(result.newState.version, i + 1);
    assert.equal((result.newState.data as { counter: number }).counter, i + 1);
    state = result.newState;
  }

  assert.equal(state.version, 5);
  assert.equal((state.data as { counter: number }).counter, 5);
});

test("ProjectionApplier rejects update with same version as current", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-same-version",
    projectionType: "test",
    version: 5,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });

  const currentState: ProjectionState = {
    data: {},
    version: 5,
  };

  const result = applier.apply(update, currentState);

  assert.equal(result.success, false);
  assert.equal(applier.canApply(update, currentState), false);
});

test("ProjectionApplier handles version 0 initial state", () => {
  const applier = createProjectionApplier();

  const update = createProjectionUpdate({
    projectionId: "proj-initial",
    projectionType: "initial-test",
    version: 1,
    sourceEvents: ["evt-init"],
    patch: { initialized: true },
    triggeredBy: "init-tester",
  });

  const initialState: ProjectionState = {
    data: {},
    version: 0,
  };

  const result = applier.apply(update, initialState);

  assert.equal(result.success, true);
  assert.equal(result.newState.version, 1);
  assert.equal(result.newState.data.initialized, true);
});
