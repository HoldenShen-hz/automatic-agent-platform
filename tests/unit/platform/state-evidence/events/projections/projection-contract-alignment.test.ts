import assert from "node:assert/strict";
import test from "node:test";

import type { ProjectionInputEvent } from "../../../../../../src/platform/state-evidence/projections/projection-rebuild-service.js";
import { artifactCatalogProjectionHandler } from "../../../../../../src/platform/state-evidence/events/projections/artifact-catalog-projection.js";
import { governanceProjectionHandler } from "../../../../../../src/platform/state-evidence/events/projections/governance-projection.js";
import { riskActionProjectionHandler } from "../../../../../../src/platform/state-evidence/events/projections/risk-action-projection.js";
import { workerStatusProjectionHandler } from "../../../../../../src/platform/state-evidence/events/projections/worker-status-projection.js";
import { toolUsageProjectionHandler } from "../../../../../../src/platform/state-evidence/events/projections/tool-usage-projection.js";
import { workflowTimelineProjectionHandler } from "../../../../../../src/platform/state-evidence/events/projections/workflow-timeline-projection.js";

type ProjectionHandlerFn = (state: Record<string, unknown> | null, event: ProjectionInputEvent) => Record<string, unknown>;

interface ProjectionCase {
  name: string;
  handler: ProjectionHandlerFn;
  event: ProjectionInputEvent;
}

function makeEvent(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
  createdAt: string,
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId: "task-1",
    payloadJson: JSON.stringify(payload),
    createdAt,
  };
}

const recentCreatedAt = new Date().toISOString();
const staleCreatedAt = new Date(Date.now() - 10 * 60_000).toISOString();

const projectionCases: ProjectionCase[] = [
  {
    name: "artifactCatalogProjectionHandler",
    handler: artifactCatalogProjectionHandler,
    event: makeEvent("evt-artifact", "artifact:created", { artifactId: "artifact-1" }, recentCreatedAt),
  },
  {
    name: "governanceProjectionHandler",
    handler: governanceProjectionHandler,
    event: makeEvent("evt-governance", "policy:created", { policyId: "policy-1" }, recentCreatedAt),
  },
  {
    name: "riskActionProjectionHandler",
    handler: riskActionProjectionHandler,
    event: makeEvent("evt-risk", "risk:decision_requested", { riskDecisionId: "risk-1" }, recentCreatedAt),
  },
  {
    name: "workerStatusProjectionHandler",
    handler: workerStatusProjectionHandler,
    event: makeEvent("evt-worker", "worker:claim_accepted", { workerId: "worker-1" }, recentCreatedAt),
  },
  {
    name: "toolUsageProjectionHandler",
    handler: toolUsageProjectionHandler,
    event: makeEvent("evt-tool", "plugin:invocation_started", { pluginId: "plugin-1" }, recentCreatedAt),
  },
  {
    name: "workflowTimelineProjectionHandler",
    handler: workflowTimelineProjectionHandler,
    event: makeEvent("evt-workflow", "workflow:started", { workflowId: "workflow-1" }, recentCreatedAt),
  },
];

test("projection handlers keep processedEventIds as Set and remain idempotent", () => {
  for (const projectionCase of projectionCases) {
    const firstState = projectionCase.handler(null, projectionCase.event) as {
      processedEventIds: ReadonlySet<string>;
      eventCount: number;
    };
    const replayedState = projectionCase.handler(firstState as Record<string, unknown>, projectionCase.event) as {
      processedEventIds: ReadonlySet<string>;
      eventCount: number;
    };

    assert.ok(firstState.processedEventIds instanceof Set, `${projectionCase.name} should expose Set-backed processedEventIds`);
    assert.deepEqual(firstState.processedEventIds, new Set([projectionCase.event.eventId]));
    assert.equal(replayedState.eventCount, 1, `${projectionCase.name} should skip duplicate events`);
  }
});

test("projection handlers expose freshness metadata", () => {
  const staleCases: ProjectionCase[] = projectionCases.map((projectionCase, index) => ({
    ...projectionCase,
    event: {
      ...projectionCase.event,
      eventId: `${projectionCase.event.eventId}-stale-${index}`,
      createdAt: staleCreatedAt,
    },
  }));

  for (const projectionCase of staleCases) {
    const state = projectionCase.handler(null, projectionCase.event) as {
      lastProjectedAt: string | null;
      lagMs: number | null;
      stale: boolean;
    };

    assert.equal(state.lastProjectedAt, staleCreatedAt, `${projectionCase.name} should persist lastProjectedAt`);
    assert.ok(state.lagMs !== null && state.lagMs >= 10 * 60_000, `${projectionCase.name} should expose lagMs`);
    assert.equal(state.stale, true, `${projectionCase.name} should mark old projections as stale`);
  }
});
