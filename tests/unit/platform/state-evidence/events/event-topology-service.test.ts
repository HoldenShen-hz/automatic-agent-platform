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

test("EventTopologyService.listEntries returns all registered event types", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  assert.ok(entries.length > 0);
  assert.ok(entries.some((entry) => entry.eventType === "task:status_changed"));
  assert.ok(entries.some((entry) => entry.eventType === "workflow:step_completed"));
  assert.ok(entries.some((entry) => entry.eventType === "decision:requested"));
});

test("EventTopologyService.listEntries includes reliableAckRequired based on tier", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  const tier1Entries = entries.filter((entry) => entry.tier === "tier_1");
  for (const entry of tier1Entries) {
    assert.equal(entry.reliableAckRequired, true, `${entry.eventType} should require reliable ack`);
  }

  const tier2Entries = entries.filter((entry) => entry.tier === "tier_2");
  const tier3Entries = entries.filter((entry) => entry.tier === "tier_3");
  for (const entry of [...tier2Entries, ...tier3Entries]) {
    assert.equal(entry.reliableAckRequired, false, `${entry.eventType} should not require reliable ack`);
  }
});

test("EventTopologyService.listEntries extracts namespace from event type", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    const expectedNamespace = entry.eventType.split(":")[0];
    assert.equal(entry.namespace, expectedNamespace, `${entry.eventType} should have namespace ${expectedNamespace}`);
  }
});

test("EventTopologyService.listEntries includes payloadSchemaRef for each event", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    assert.ok(entry.payloadSchemaRef.startsWith("event://"), `${entry.eventType} should have event:// schema ref`);
  }
});

test("EventTopologyService.listEntries includes producer and consumers", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    assert.ok(typeof entry.producer === "string");
    assert.ok(Array.isArray(entry.consumers));
  }
});

test("EventTopologyService.buildSummary returns correct totalEvents", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();
  const entries = service.listEntries();

  assert.equal(summary.totalEvents, entries.length);
});

test("EventTopologyService.buildSummary returns sorted namespaces", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  for (let i = 1; i < summary.namespaces.length; i++) {
    assert.ok(
      summary.namespaces[i - 1]! < summary.namespaces[i]!,
      `Namespace ${summary.namespaces[i - 1]} should be before ${summary.namespaces[i]}`,
    );
  }
});

test("EventTopologyService.buildSummary returns tier counts summing to total", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  const sum = summary.tierCounts.tier_1 + summary.tierCounts.tier_2 + summary.tierCounts.tier_3;
  assert.equal(sum, summary.totalEvents);
});

test("EventTopologyService.buildSummary returns sorted producers and consumers", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  for (let i = 1; i < summary.producers.length; i++) {
    assert.ok(
      summary.producers[i - 1]! < summary.producers[i]!,
      `Producer ${summary.producers[i - 1]} should be before ${summary.producers[i]}`,
    );
  }

  for (let i = 1; i < summary.consumers.length; i++) {
    assert.ok(
      summary.consumers[i - 1]! < summary.consumers[i]!,
      `Consumer ${summary.consumers[i - 1]} should be before ${summary.consumers[i]}`,
    );
  }
});

test("EventTopologyService.buildGraph returns nodes with correct kinds", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  const producerNodes = graph.nodes.filter((node) => node.kind === "producer");
  const eventNodes = graph.nodes.filter((node) => node.kind === "event");
  const consumerNodes = graph.nodes.filter((node) => node.kind === "consumer");

  assert.ok(producerNodes.length > 0);
  assert.ok(eventNodes.length > 0);
  assert.ok(consumerNodes.length > 0);
});

test("EventTopologyService.buildGraph edges have valid tier values", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  for (const edge of graph.edges) {
    assert.ok(
      edge.tier === "tier_1" || edge.tier === "tier_2" || edge.tier === "tier_3",
      `Edge should have valid tier, got ${edge.tier}`,
    );
  }
});

test("EventTopologyService.buildGraph emits edges connect producers to events", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  const emitEdges = graph.edges.filter((edge) => edge.relation === "emits");
  for (const edge of emitEdges) {
    assert.ok(edge.source.startsWith("producer:"));
    assert.ok(edge.target.startsWith("event:"));
  }
});

test("EventTopologyService.buildGraph consumes edges connect events to consumers", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  const consumeEdges = graph.edges.filter((edge) => edge.relation === "consumes");
  for (const edge of consumeEdges) {
    assert.ok(edge.source.startsWith("event:"));
    assert.ok(edge.target.startsWith("consumer:"));
  }
});

test("EventTopologyService.listNamespaceEntries returns entries for valid namespace", () => {
  const service = new EventTopologyService();
  const taskEntries = service.listNamespaceEntries("task");

  assert.ok(taskEntries.length > 0);
  assert.ok(taskEntries.every((entry) => entry.namespace === "task"));
});

test("EventTopologyService.listNamespaceEntries returns empty array for unknown namespace", () => {
  const service = new EventTopologyService();
  const unknownEntries = service.listNamespaceEntries("nonexistent_namespace_xyz");

  assert.equal(unknownEntries.length, 0);
});

test("EventTopologyService.listNamespaceEntries returns entries with correct tier", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const namespaces = [...new Set(entries.map((e) => e.namespace))];

  for (const ns of namespaces) {
    const nsEntries = service.listNamespaceEntries(ns);
    assert.equal(nsEntries.length, entries.filter((e) => e.namespace === ns).length);
  }
});

test("EventTopologyService.listNamespaceEntries task namespace includes task_projection consumer", () => {
  const service = new EventTopologyService();
  const taskEntries = service.listNamespaceEntries("task");

  const statusChanged = taskEntries.find((e) => e.eventType === "task:status_changed");
  assert.ok(statusChanged);
  assert.ok(statusChanged.consumers.includes("task_projection"));
});

test("EventTopologyService.listNamespaceEntries workflow namespace includes workflow_projection consumer", () => {
  const service = new EventTopologyService();
  const workflowEntries = service.listNamespaceEntries("workflow");

  assert.ok(workflowEntries.length > 0);
  const stepCompleted = workflowEntries.find((e) => e.eventType === "workflow:step_completed");
  assert.ok(stepCompleted);
  assert.ok(stepCompleted.consumers.includes("workflow_projection"));
});

test("EventTopologyService multiple calls return consistent results", () => {
  const service = new EventTopologyService();

  const entries1 = service.listEntries();
  const entries2 = service.listEntries();
  assert.deepEqual(entries1, entries2);

  const graph1 = service.buildGraph();
  const graph2 = service.buildGraph();
  assert.deepEqual(graph1.nodes, graph2.nodes);
  assert.deepEqual(graph1.edges, graph2.edges);

  const summary1 = service.buildSummary();
  const summary2 = service.buildSummary();
  assert.deepEqual(summary1, summary2);
});
