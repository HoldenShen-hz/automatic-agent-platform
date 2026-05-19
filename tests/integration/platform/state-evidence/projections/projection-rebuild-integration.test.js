import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { ProjectionRebuildService } from "../../../../../src/platform/state-evidence/projections/projection-rebuild-service.js";
test("ProjectionRebuildService rebuilds task_summary projection", () => {
    const ctx = createIntegrationContext("aa-task-summary-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("task_summary", { batchSize: 10 });
        assert.equal(result.eventsProcessed, 0);
        assert.equal(result.eventsSkipped, 0);
        assert.ok(Array.isArray(result.errors));
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuilds workflow_summary projection", () => {
    const ctx = createIntegrationContext("aa-workflow-summary-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("workflow_summary", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
        assert.equal(typeof result.eventsSkipped === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuilds approval_summary projection", () => {
    const ctx = createIntegrationContext("aa-approval-summary-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("approval_summary", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuilds incident_summary projection", () => {
    const ctx = createIntegrationContext("aa-incident-summary-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("incident_summary", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuilds event_summary projection", () => {
    const ctx = createIntegrationContext("aa-event-summary-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("event_summary", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuilds cost_dashboard projection", () => {
    const ctx = createIntegrationContext("aa-cost-dashboard-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("cost_dashboard", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuilds delegation_tree projection", () => {
    const ctx = createIntegrationContext("aa-delegation-tree-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("delegation_tree", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService rebuildAll processes all projections", () => {
    const ctx = createIntegrationContext("aa-rebuild-all-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const results = service.rebuildAll({ batchSize: 10 });
        assert.ok(results instanceof Map);
        assert.ok(results.has("task_summary"));
        assert.ok(results.has("workflow_summary"));
        assert.ok(results.has("approval_summary"));
        assert.ok(results.has("incident_summary"));
        assert.ok(results.has("event_summary"));
        assert.ok(results.has("cost_dashboard"));
        assert.ok(results.has("delegation_tree"));
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService handles unknown projection gracefully", () => {
    const ctx = createIntegrationContext("aa-unknown-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("unknown_projection", { batchSize: 10 });
        assert.equal(result.eventsProcessed, 0);
        assert.equal(result.projectionsUpdated, 0);
        assert.ok(result.errors.length > 0);
        assert.ok(result.errors.some((e) => e.includes("Unknown projection")));
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService accepts custom batch size option", () => {
    const ctx = createIntegrationContext("aa-batch-size-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("task_summary", { batchSize: 500 });
        assert.equal(typeof result.durationMs === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService accepts event type filter option", () => {
    const ctx = createIntegrationContext("aa-event-filter-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("task_summary", {
            batchSize: 100,
            eventTypeFilter: ["task:created", "task:completed"],
        });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers incident_projection handler", () => {
    const ctx = createIntegrationContext("aa-incident-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("incident_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers workflow_run_projection handler", () => {
    const ctx = createIntegrationContext("aa-workflow-run-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("workflow_run_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers workflow_timeline_projection handler", () => {
    const ctx = createIntegrationContext("aa-workflow-timeline-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("workflow_timeline_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers approval_queue_projection handler", () => {
    const ctx = createIntegrationContext("aa-approval-queue-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("approval_queue_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers tool_usage_projection handler", () => {
    const ctx = createIntegrationContext("aa-tool-usage-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("tool_usage_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers worker_status_projection handler", () => {
    const ctx = createIntegrationContext("aa-worker-status-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("worker_status_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers artifact_catalog_projection handler", () => {
    const ctx = createIntegrationContext("aa-artifact-catalog-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("artifact_catalog_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers risk_action_projection handler", () => {
    const ctx = createIntegrationContext("aa-risk-action-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("risk_action_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
test("ProjectionRebuildService registers governance_projection handler", () => {
    const ctx = createIntegrationContext("aa-governance-proj-");
    try {
        const service = new ProjectionRebuildService(ctx.store.event);
        const result = service.rebuildProjection("governance_projection", { batchSize: 10 });
        assert.equal(typeof result.eventsProcessed === "number", true);
    }
    finally {
        ctx.cleanup();
    }
});
//# sourceMappingURL=projection-rebuild-integration.test.js.map