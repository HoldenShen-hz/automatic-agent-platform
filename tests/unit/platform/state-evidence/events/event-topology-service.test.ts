import assert from "node:assert/strict";
import test from "node:test";

import { EventTopologyService } from "../../../../../src/platform/state-evidence/events/event-topology-service.js";
import { EVENT_SCHEMA_REGISTRY } from "../../../../../src/platform/state-evidence/events/event-registry.js";

const KNOWN_TIERS = ["tier_1", "tier_2", "tier_3"] as const;
const EXPECTED_NAMESPACES = [
  "decision",
  "delegation",
  "division",
  "domain",
  "knowledge",
  "learning",
  "plugin",
  "prompt",
  "skill",
  "stream",
  "subtask",
  "task",
  "cost",
  "tenant",
  "pack",
  "marketplace",
  "anomaly",
  "slo",
  "compliance",
  "dispatch",
  "worker",
  "takeover",
  "recovery",
  "perf",
  "test",
] as const;

test("EventTopologyService listEntries returns all registered event entries", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const registryKeys = Object.keys(EVENT_SCHEMA_REGISTRY);

  assert.ok(Array.isArray(entries));
  assert.equal(entries.length, registryKeys.length);
});

test("EventTopologyService listEntries maps event schema fields correctly", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    const schema = EVENT_SCHEMA_REGISTRY[entry.eventType as keyof typeof EVENT_SCHEMA_REGISTRY];

    assert.ok(typeof entry.eventType === "string");
    assert.ok(entry.eventType.includes(":"), "eventType should contain colon separator");
    assert.equal(entry.eventType, schema.type);

    assert.ok(typeof entry.namespace === "string");
    const expectedNamespace = entry.eventType.split(":")[0];
    assert.equal(entry.namespace, expectedNamespace);

    assert.ok(KNOWN_TIERS.includes(entry.tier), `tier should be valid: ${entry.tier}`);
    assert.equal(entry.tier, schema.tier);

    assert.ok(typeof entry.producer === "string");
    assert.equal(entry.producer, schema.producer);

    assert.ok(Array.isArray(entry.consumers));
    assert.deepEqual(entry.consumers, [...schema.consumers]);

    assert.ok(typeof entry.payloadSchemaRef === "string");
    assert.ok(entry.payloadSchemaRef.startsWith("event://"));
    assert.ok(entry.payloadSchemaRef.includes(entry.eventType.replaceAll(":", "/")));

    assert.ok(typeof entry.reliableAckRequired === "boolean");
  }
});

test("EventTopologyService listEntries sets reliableAckRequired correctly based on tier", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    if (entry.tier === "tier_1") {
      assert.equal(entry.reliableAckRequired, true, `${entry.eventType} should require reliable ack`);
    } else {
      assert.equal(entry.reliableAckRequired, false, `${entry.eventType} should not require reliable ack`);
    }
  }
});

test("EventTopologyService listEntries handles events with empty consumers (tier_3)", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  const tier3Entries = entries.filter((e) => e.tier === "tier_3");
  assert.ok(tier3Entries.length > 0, "should have tier_3 events");

  for (const entry of tier3Entries) {
    assert.ok(Array.isArray(entry.consumers));
    assert.equal(entry.consumers.length, 0, `${entry.eventType} should have no consumers`);
  }
});

test("EventTopologyService listEntries handles events with multiple consumers (tier_1)", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  const tier1Entries = entries.filter((e) => e.tier === "tier_1");
  assert.ok(tier1Entries.length > 0, "should have tier_1 events");

  for (const entry of tier1Entries) {
    assert.ok(entry.consumers.length > 0, `${entry.eventType} should have consumers`);
    // inspect_projection is a common consumer
    assert.ok(entry.consumers.includes("inspect_projection"), `${entry.eventType} should include inspect_projection`);
  }
});

test("EventTopologyService listEntries namespace extraction handles missing colon", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    // All event types should have colon and namespace should be extracted
    if (entry.eventType.includes(":")) {
      const parts = entry.eventType.split(":");
      assert.equal(entry.namespace, parts[0]);
    }
  }
});

test("EventTopologyService buildGraph creates correct node structure", () => {
  const service = new EventTopologyService();
  const { nodes, edges } = service.buildGraph();

  assert.ok(Array.isArray(nodes));
  assert.ok(Array.isArray(edges));

  // Verify node structure
  for (const node of nodes) {
    assert.ok(typeof node.nodeId === "string");
    assert.ok(node.nodeId.includes(":"));
    assert.ok(["producer", "event", "consumer"].includes(node.kind));
  }

  // Verify all nodes are unique
  const nodeIds = nodes.map((n) => n.nodeId);
  assert.equal(nodeIds.length, new Set(nodeIds).size, "nodes should be unique");
});

test("EventTopologyService buildGraph includes producer, event, and consumer nodes", () => {
  const service = new EventTopologyService();
  const { nodes } = service.buildGraph();

  const kinds = new Set(nodes.map((n) => n.kind));
  assert.ok(kinds.has("producer"), "should have producer nodes");
  assert.ok(kinds.has("event"), "should have event nodes");
  assert.ok(kinds.has("consumer"), "should have consumer nodes");
});

test("EventTopologyService buildGraph creates emits edges from producer to event", () => {
  const service = new EventTopologyService();
  const { nodes, edges } = service.buildGraph();

  const emitsEdges = edges.filter((e) => e.relation === "emits");
  assert.ok(emitsEdges.length > 0, "should have emits edges");

  const nodeIds = new Set(nodes.map((n) => n.nodeId));

  for (const edge of emitsEdges) {
    assert.ok(nodeIds.has(edge.source), `source ${edge.source} should be in nodes`);
    assert.ok(nodeIds.has(edge.target), `target ${edge.target} should be in nodes`);
    assert.ok(edge.source.startsWith("producer:"), `source should be producer node`);
    assert.ok(edge.target.startsWith("event:"), `target should be event node`);
    assert.ok(KNOWN_TIERS.includes(edge.tier), "edge should have valid tier");
  }

  // Number of emits edges should equal number of events
  const eventNodes = nodes.filter((n) => n.kind === "event");
  assert.equal(emitsEdges.length, eventNodes.length, "each event should have one emits edge");
});

test("EventTopologyService buildGraph creates consumes edges from event to consumer", () => {
  const service = new EventTopologyService();
  const { nodes, edges } = service.buildGraph();

  const consumesEdges = edges.filter((e) => e.relation === "consumes");
  const nodeIds = new Set(nodes.map((n) => n.nodeId));

  for (const edge of consumesEdges) {
    assert.ok(nodeIds.has(edge.source), `source ${edge.source} should be in nodes`);
    assert.ok(nodeIds.has(edge.target), `target ${edge.target} should be in nodes`);
    assert.ok(edge.source.startsWith("event:"), `source should be event node`);
    assert.ok(edge.target.startsWith("consumer:"), `target should be consumer node`);
    assert.ok(KNOWN_TIERS.includes(edge.tier), "edge should have valid tier");
  }

  // Events with no consumers (e.g., tier_3 events) should have no consumes edges
  const tier3EventNodes = nodes.filter(
    (n) => n.kind === "event" && n.nodeId.split(":")[1] && !consumesEdges.some((e) => e.source === n.nodeId),
  );
  // This is fine - tier_3 events have no consumers so no consumes edges needed
});

test("EventTopologyService buildGraph edge count matches entry consumers", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const { edges } = service.buildGraph();

  const emitsEdges = edges.filter((e) => e.relation === "emits");
  const consumesEdges = edges.filter((e) => e.relation === "consumes");

  // emits edges count should equal number of entries
  assert.equal(emitsEdges.length, entries.length);

  // total consumes edges should equal total consumers across all entries
  const totalConsumers = entries.reduce((sum, e) => sum + e.consumers.length, 0);
  assert.equal(consumesEdges.length, totalConsumers);
});

test("EventTopologyService buildGraph nodes are derived from all producers, events, and consumers", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const { nodes } = service.buildGraph();

  // Collect expected producers, events, consumers
  const expectedProducers = new Set(entries.map((e) => `producer:${e.producer}`));
  const expectedEvents = new Set(entries.map((e) => `event:${e.eventType}`));
  const expectedConsumers = new Set(entries.flatMap((e) => e.consumers.map((c) => `consumer:${c}`)));

  const actualNodeIds = new Set(nodes.map((n) => n.nodeId));

  for (const producer of expectedProducers) {
    assert.ok(actualNodeIds.has(producer), `producer node ${producer} should exist`);
  }

  for (const event of expectedEvents) {
    assert.ok(actualNodeIds.has(event), `event node ${event} should exist`);
  }

  for (const consumer of expectedConsumers) {
    assert.ok(actualNodeIds.has(consumer), `consumer node ${consumer} should exist`);
  }
});

test("EventTopologyService buildSummary returns correct totalEvents", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const summary = service.buildSummary();

  assert.equal(summary.totalEvents, entries.length);
  assert.equal(summary.totalEvents, Object.keys(EVENT_SCHEMA_REGISTRY).length);
});

test("EventTopologyService buildSummary returns correct tierCounts", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const summary = service.buildSummary();

  assert.ok("tier_1" in summary.tierCounts);
  assert.ok("tier_2" in summary.tierCounts);
  assert.ok("tier_3" in summary.tierCounts);

  // Count tiers from entries
  const expectedTierCounts = { tier_1: 0, tier_2: 0, tier_3: 0 };
  for (const entry of entries) {
    expectedTierCounts[entry.tier]++;
  }

  assert.equal(summary.tierCounts.tier_1, expectedTierCounts.tier_1);
  assert.equal(summary.tierCounts.tier_2, expectedTierCounts.tier_2);
  assert.equal(summary.tierCounts.tier_3, expectedTierCounts.tier_3);

  // Sum of tier counts should equal total events
  const sum = summary.tierCounts.tier_1 + summary.tierCounts.tier_2 + summary.tierCounts.tier_3;
  assert.equal(sum, summary.totalEvents);
});

test("EventTopologyService buildSummary namespaces are sorted and unique", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  // Should be sorted
  const sorted = [...summary.namespaces].sort();
  assert.deepEqual(summary.namespaces, sorted);

  // Should be unique
  assert.equal(summary.namespaces.length, new Set(summary.namespaces).size);

  // Each namespace should appear in entries
  const entryNamespaces = new Set(service.listEntries().map((e) => e.namespace));
  for (const ns of summary.namespaces) {
    assert.ok(entryNamespaces.has(ns), `namespace ${ns} should be in entries`);
  }
});

test("EventTopologyService buildSummary producers are sorted and unique", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const summary = service.buildSummary();

  // Should be sorted
  const sorted = [...summary.producers].sort();
  assert.deepEqual(summary.producers, sorted);

  // Should be unique
  assert.equal(summary.producers.length, new Set(summary.producers).size);

  // Each producer should appear in entries
  const entryProducers = new Set(entries.map((e) => e.producer));
  for (const producer of summary.producers) {
    assert.ok(entryProducers.has(producer), `producer ${producer} should be in entries`);
  }
});

test("EventTopologyService buildSummary consumers are sorted and unique", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const summary = service.buildSummary();

  // Should be sorted
  const sorted = [...summary.consumers].sort();
  assert.deepEqual(summary.consumers, sorted);

  // Should be unique
  assert.equal(summary.consumers.length, new Set(summary.consumers).size);

  // Each consumer should appear in entries
  const entryConsumers = new Set(entries.flatMap((e) => e.consumers));
  for (const consumer of summary.consumers) {
    assert.ok(entryConsumers.has(consumer), `consumer ${consumer} should be in entries`);
  }
});

test("EventTopologyService buildSummary consumers exclude duplicates across events", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  // inspect_projection is a common consumer across many events
  // but should only appear once in the consumers list
  const inspectCount = summary.consumers.filter((c) => c === "inspect_projection").length;
  assert.equal(inspectCount, 1, "inspect_projection should appear only once despite being in many events");
});

test("EventTopologyService listNamespaceEntries filters by namespace correctly", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  // Pick a namespace that exists
  const namespaces = [...new Set(entries.map((e) => e.namespace))];
  assert.ok(namespaces.length > 0, "should have namespaces");

  for (const namespace of namespaces) {
    const filtered = service.listNamespaceEntries(namespace);

    assert.ok(Array.isArray(filtered));
    assert.ok(filtered.length > 0, `namespace ${namespace} should have entries`);

    for (const entry of filtered) {
      assert.equal(entry.namespace, namespace);
    }

    // Verify count matches manually filtering
    const manualFilter = entries.filter((e) => e.namespace === namespace);
    assert.equal(filtered.length, manualFilter.length);
  }
});

test("EventTopologyService listNamespaceEntries returns empty array for unknown namespace", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  // Create a namespace that definitely doesn't exist
  const existingNamespaces = new Set(entries.map((e) => e.namespace));
  let unknownNamespace = "completely-unknown-namespace-xyz";
  let attempts = 0;
  while (existingNamespaces.has(unknownNamespace) && attempts < 10) {
    unknownNamespace = `unknown-${Math.random().toString(36)}`;
    attempts++;
  }

  const filtered = service.listNamespaceEntries(unknownNamespace);
  assert.deepEqual(filtered, []);
});

test("EventTopologyService listNamespaceEntries returns empty array for empty string namespace", () => {
  const service = new EventTopologyService();
  const filtered = service.listNamespaceEntries("");
  // Empty string is not a valid namespace (all events have colon separator)
  // This should return empty since no event has empty string as namespace
  assert.deepEqual(filtered, []);
});

test("EventTopologyService listNamespaceEntries handles namespace with no events", () => {
  const service = new EventTopologyService();

  // All events have namespaces derived from before the colon
  // Use a namespace format that doesn't match any event
  const filtered = service.listNamespaceEntries("nonexistent");
  assert.deepEqual(filtered, []);
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

  const nsEntries1 = service.listNamespaceEntries("task");
  const nsEntries2 = service.listNamespaceEntries("task");
  assert.deepEqual(nsEntries1, nsEntries2);
});

test("EventTopologyService listEntries returns defensive copies of arrays", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  // Modify returned consumers array
  if (entries.length > 0) {
    const originalLength = entries[0].consumers.length;
    entries[0].consumers.push("test-consumer");

    // Call again and verify original is unchanged
    const entries2 = service.listEntries();
    assert.equal(entries2[0].consumers.length, originalLength);
  }
});

test("EventTopologyService graph edges maintain referential integrity", () => {
  const service = new EventTopologyService();
  const { nodes, edges } = service.buildGraph();

  // Every edge source and target should reference an existing node
  const nodeIdSet = new Set(nodes.map((n) => n.nodeId));

  for (const edge of edges) {
    assert.ok(nodeIdSet.has(edge.source), `edge source ${edge.source} should exist`);
    assert.ok(nodeIdSet.has(edge.target), `edge target ${edge.target} should exist`);
  }
});

test("EventTopologyService handles event types with complex namespaces", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  // Verify all event types follow namespace:typename format
  for (const entry of entries) {
    assert.ok(
      entry.eventType.includes(":"),
      `${entry.eventType} should contain colon separator`,
    );
    const parts = entry.eventType.split(":");
    assert.ok(parts.length >= 2, `${entry.eventType} should have at least 2 parts after split`);
    assert.equal(entry.namespace, parts[0]);
  }
});

test("EventTopologyService tier assignment matches registry", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    const schema = EVENT_SCHEMA_REGISTRY[entry.eventType as keyof typeof EVENT_SCHEMA_REGISTRY];
    assert.equal(entry.tier, schema.tier, `${entry.eventType} tier should match registry`);
  }
});

test("EventTopologyService summary reflects exact counts from registry", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  const registryKeys = Object.keys(EVENT_SCHEMA_REGISTRY);
  assert.equal(summary.totalEvents, registryKeys.length);

  // Count by tier directly from registry
  const directTierCounts = { tier_1: 0, tier_2: 0, tier_3: 0 };
  for (const key of registryKeys) {
    const tier = EVENT_SCHEMA_REGISTRY[key as keyof typeof EVENT_SCHEMA_REGISTRY].tier;
    directTierCounts[tier]++;
  }

  assert.equal(summary.tierCounts.tier_1, directTierCounts.tier_1);
  assert.equal(summary.tierCounts.tier_2, directTierCounts.tier_2);
  assert.equal(summary.tierCounts.tier_3, directTierCounts.tier_3);
});
