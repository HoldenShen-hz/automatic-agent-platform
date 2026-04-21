import assert from "node:assert/strict";
import test from "node:test";
import { EventTopologyService } from "../../../../../src/platform/state-evidence/events/event-topology-service.js";
test("EventTopologyService builds event entries with namespace and reliability semantics", () => {
    const service = new EventTopologyService();
    const taskEntries = service.listNamespaceEntries("task");
    const summary = service.buildSummary();
    assert.ok(taskEntries.some((entry) => entry.eventType === "task:status_changed"));
    assert.ok(taskEntries.every((entry) => entry.namespace === "task"));
    assert.ok(summary.tierCounts.tier_1 > 0);
});
test("EventTopologyService builds producer-event-consumer graph edges", () => {
    const service = new EventTopologyService();
    const graph = service.buildGraph();
    assert.ok(graph.nodes.some((node) => node.nodeId === "producer:approval_service"));
    assert.ok(graph.nodes.some((node) => node.nodeId === "event:decision:requested"));
    assert.ok(graph.edges.some((edge) => edge.source === "producer:approval_service" && edge.relation === "emits"));
    assert.ok(graph.edges.some((edge) => edge.target === "consumer:inspect_projection" && edge.relation === "consumes"));
});
//# sourceMappingURL=event-topology-service.test.js.map