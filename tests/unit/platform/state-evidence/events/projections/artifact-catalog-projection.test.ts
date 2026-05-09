import test from "node:test";
import assert from "node:assert/strict";

import {
  artifactCatalogProjectionHandler,
  createEmptyArtifactCatalogState,
  createArtifactCatalogProjectionHandler,
  type ArtifactCatalogState,
  type ProjectionInputEvent,
} from "../../../../../../src/platform/state-evidence/events/projections/artifact-catalog-projection.js";

/**
 * Helper to create a projection input event
 */
function makeEvent(
  eventId: string,
  eventType: string,
  taskId: string | null = null,
  payloadJson: string = "{}",
  createdAt: string = "2026-04-19T10:00:00.000Z",
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId,
    payloadJson,
    createdAt,
  };
}

test("artifactCatalogProjectionHandler initializes state correctly", () => {
  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1","artifactType":"file"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.artifactId, "artifact_1");
  assert.equal(state.artifactType, "file");
  assert.equal(state.taskId, "task_1");
  assert.equal(state.status, "created");
  assert.equal(state.eventCount, 1);
  assert.deepEqual(state.processedEventIds, new Set(["evt_1"]));
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
});

test("artifactCatalogProjectionHandler handles artifact:created", () => {
  const event = makeEvent(
    "evt_create",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_abc","artifactName":"output.txt","mimeType":"text/plain"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.artifactId, "artifact_abc");
  assert.equal(state.artifactName, "output.txt");
  assert.equal(state.mimeType, "text/plain");
  assert.equal(state.status, "created");
  assert.equal(state.version, 1);
});

test("artifactCatalogProjectionHandler handles workflow:artifact_linked", () => {
  const event = makeEvent(
    "evt_link",
    "workflow:artifact_linked",
    "task_1",
    '{"artifact_ref":"artifact_xyz","workflowRunId":"wf_run_1"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.artifactId, "artifact_xyz");
  assert.equal(state.workflowRunId, "wf_run_1");
  assert.equal(state.status, "created");
});

test("artifactCatalogProjectionHandler handles artifact:updated", () => {
  const event = makeEvent(
    "evt_update",
    "artifact:updated",
    "task_1",
    '{"artifactId":"artifact_1","contentHash":"hash123","sizeBytes":1024}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.status, "updated");
  assert.equal(state.contentHash, "hash123");
  assert.equal(state.sizeBytes, 1024);
  assert.equal(state.version, 2); // Incremented
});

test("artifactCatalogProjectionHandler handles artifact:sealed", () => {
  const event = makeEvent(
    "evt_seal",
    "artifact:sealed",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.status, "sealed");
});

test("artifactCatalogProjectionHandler handles artifact:deleted", () => {
  const event = makeEvent(
    "evt_del",
    "artifact:deleted",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.status, "deleted");
});

test("artifactCatalogProjectionHandler handles artifact:archived", () => {
  const event = makeEvent(
    "evt_arch",
    "artifact:archived",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.status, "archived");
});

test("artifactCatalogProjectionHandler adds unique references", () => {
  const event = makeEvent(
    "evt_ref",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1","referenceType":"workflow","referenceId":"wf_123","referencePath":"/path/to/artifact"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.references.length, 1);
  assert.equal(state.references[0]!.referenceType, "workflow");
  assert.equal(state.references[0]!.referenceId, "wf_123");
  assert.equal(state.references[0]!.referencePath, "/path/to/artifact");
});

test("artifactCatalogProjectionHandler does not duplicate references", () => {
  const event1 = makeEvent(
    "evt_ref_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1","referenceType":"workflow","referenceId":"wf_123"}',
  );
  const event2 = makeEvent(
    "evt_ref_2",
    "artifact:updated",
    "task_1",
    '{"artifactId":"artifact_1","referenceType":"workflow","referenceId":"wf_123"}',
  );

  const state1 = artifactCatalogProjectionHandler(null, event1) as unknown as ArtifactCatalogState;
  const state2 = artifactCatalogProjectionHandler(
    state1 as unknown as Record<string, unknown>,
    event2,
  ) as unknown as ArtifactCatalogState;

  // Should not duplicate the same reference
  assert.equal(state2.references.length, 1);
});

test("artifactCatalogProjectionHandler is idempotent - same event twice", () => {
  const event = makeEvent(
    "evt_idem_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );

  const state1 = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;
  const state2 = artifactCatalogProjectionHandler(
    state1 as unknown as Record<string, unknown>,
    event,
  ) as unknown as ArtifactCatalogState;

  // Second event should be skipped
  assert.equal(state2.eventCount, 1);
  assert.deepEqual(state2.processedEventIds, new Set(["evt_idem_1"]));
});

test("artifactCatalogProjectionHandler accumulates multiple events", () => {
  const createEvent = makeEvent(
    "evt_create",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );
  const updateEvent = makeEvent(
    "evt_update",
    "artifact:updated",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );

  const state1 = artifactCatalogProjectionHandler(null, createEvent) as unknown as ArtifactCatalogState;
  const state2 = artifactCatalogProjectionHandler(
    state1 as unknown as Record<string, unknown>,
    updateEvent,
  ) as unknown as ArtifactCatalogState;

  assert.equal(state2.eventCount, 2);
  assert.equal(state2.status, "updated");
  assert.equal(state2.version, 2);
  assert.deepEqual(state2.processedEventIds, new Set(["evt_create", "evt_update"]));
});

test("createArtifactCatalogProjectionHandler returns handler function", () => {
  const factory = createArtifactCatalogProjectionHandler();

  assert.equal(typeof factory, "function");

  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1"}',
  );
  const state = factory(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.artifactId, "artifact_1");
});

test("artifactCatalogProjectionHandler parses payload with size field", () => {
  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1","size":2048}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  // Should handle both "sizeBytes" and "size" fields
  assert.equal(state.sizeBytes, 2048);
});

test("artifactCatalogProjectionHandler timeline tracks events in order", () => {
  const events = [
    makeEvent(
      "evt_1",
      "artifact:created",
      "task_1",
      '{"artifactId":"artifact_1"}',
      "2026-04-19T10:00:00.000Z",
    ),
    makeEvent(
      "evt_2",
      "artifact:updated",
      "task_1",
      '{"artifactId":"artifact_1"}',
      "2026-04-19T10:01:00.000Z",
    ),
    makeEvent(
      "evt_3",
      "artifact:sealed",
      "task_1",
      '{"artifactId":"artifact_1"}',
      "2026-04-19T10:02:00.000Z",
    ),
  ];

  let state: ArtifactCatalogState | null = null;
  for (const evt of events) {
    state = artifactCatalogProjectionHandler(
      state as unknown as Record<string, unknown>,
      evt,
    ) as unknown as ArtifactCatalogState;
  }

  assert.equal(state!.timeline.length, 3);
  assert.equal(state!.timeline[0]!.eventType, "artifact:created");
  assert.equal(state!.timeline[1]!.eventType, "artifact:updated");
  assert.equal(state!.timeline[2]!.eventType, "artifact:sealed");
});

test("createEmptyArtifactCatalogState returns correct initial state", () => {
  const state = createEmptyArtifactCatalogState();

  assert.equal(state.artifactId, null);
  assert.equal(state.artifactType, null);
  assert.equal(state.status, "created");
  assert.equal(state.version, 1);
  assert.equal(state.references.length, 0);
  assert.deepEqual(state.processedEventIds, new Set());
  assert.deepEqual(state.timeline, []);
});

test("artifactCatalogProjectionHandler handles invalid JSON payload gracefully", () => {
  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    "not valid json",
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  // Should still initialize state, just with empty payload
  assert.equal(state.eventCount, 1);
  assert.equal(state.artifactId, null);
});

test("artifactCatalogProjectionHandler skips traceContext in details", () => {
  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1","traceContext":{"traceId":"abc"}}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  // traceContext should be excluded from details
  assert.equal(state.timeline[0]!.details!["traceContext"], undefined);
  assert.equal(state.timeline[0]!.details!["artifactId"], "artifact_1");
});

test("artifactCatalogProjectionHandler extracts actorId from payload", () => {
  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    '{"artifactId":"artifact_1","actorId":"user_456"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.timeline[0]!.actorId, "user_456");
});

test("artifactCatalogProjectionHandler uses artifactKey as fallback for artifactId", () => {
  const event = makeEvent(
    "evt_1",
    "artifact:created",
    "task_1",
    '{"artifactKey":"key_123"}',
  );

  const state = artifactCatalogProjectionHandler(null, event) as unknown as ArtifactCatalogState;

  assert.equal(state.artifactId, "key_123");
});
