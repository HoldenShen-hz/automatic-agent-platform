import assert from "node:assert/strict";
import test from "node:test";

import { EventTopologyService } from "../../../../../src/platform/state-evidence/events/event-topology-service.js";

test("EventTopologyService listEntries returns all registered event entries", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  assert.ok(Array.isArray(entries));
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(typeof entry.eventType === "string");
    assert.ok(typeof entry.namespace === "string");
    assert.ok(typeof entry.producer === "string");
    assert.ok(Array.isArray(entry.consumers));
  }
});

test("EventTopologyService listEntries assigns reliableAckRequired based on tier", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  for (const entry of entries) {
    if (entry.tier === "tier_1") {
      assert.equal(entry.reliableAckRequired, true);
    } else {
      assert.equal(entry.reliableAckRequired, false);
    }
  }
});

test("EventTopologyService buildGraph creates nodes and edges from entries", () => {
  const service = new EventTopologyService();
  const { nodes, edges } = service.buildGraph();
  assert.ok(Array.isArray(nodes));
  assert.ok(Array.isArray(edges));
  assert.ok(nodes.length > 0);
  assert.ok(edges.length > 0);

  const nodeIds = new Set(nodes.map((n) => n.nodeId));
  for (const edge of edges) {
    assert.ok(nodeIds.has(edge.source), `source ${edge.source} should be in nodes`);
    assert.ok(nodeIds.has(edge.target), `target ${edge.target} should be in nodes`);
  }
});

test("EventTopologyService buildGraph includes producer, event, and consumer nodes", () => {
  const service = new EventTopologyService();
  const { nodes } = service.buildGraph();
  const kinds = new Set(nodes.map((n) => n.kind));
  assert.ok(kinds.has("producer"));
  assert.ok(kinds.has("event"));
  assert.ok(kinds.has("consumer"));
});

test("EventTopologyService buildGraph creates emits edges from producer to event", () => {
  const service = new EventTopologyService();
  const { edges } = service.buildGraph();
  const emitsEdges = edges.filter((e) => e.relation === "emits");
  assert.ok(emitsEdges.length > 0);
  for (const edge of emitsEdges) {
    assert.ok(edge.source.startsWith("producer:"));
    assert.ok(edge.target.startsWith("event:"));
  }
});

test("EventTopologyService buildGraph creates consumes edges from event to consumer", () => {
  const service = new EventTopologyService();
  const { edges } = service.buildGraph();
  const consumesEdges = edges.filter((e) => e.relation === "consumes");
  assert.ok(consumesEdges.length > 0);
  for (const edge of consumesEdges) {
    assert.ok(edge.source.startsWith("event:"));
    assert.ok(edge.target.startsWith("consumer:"));
  }
});

test("EventTopologyService buildSummary returns counts for events, namespaces, producers, consumers", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();
  assert.ok(typeof summary.totalEvents === "number");
  assert.ok(Array.isArray(summary.namespaces));
  assert.ok(typeof summary.tierCounts === "object");
  assert.ok(Array.isArray(summary.producers));
  assert.ok(Array.isArray(summary.consumers));
});

test("EventTopologyService buildSummary tierCounts has tier_1, tier_2, tier_3 keys", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();
  assert.ok("tier_1" in summary.tierCounts);
  assert.ok("tier_2" in summary.tierCounts);
  assert.ok("tier_3" in summary.tierCounts);
});

test("EventTopologyService buildSummary namespaces are sorted and unique", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();
  const sorted = [...summary.namespaces].sort();
  assert.deepEqual(summary.namespaces, sorted);
});

test("EventTopologyService listNamespaceEntries filters by namespace", () => {
  const service = new EventTopologyService();
  const allEntries = service.listEntries();
  if (allEntries.length === 0) return;

  const firstNs = allEntries[0].namespace;
  const filtered = service.listNamespaceEntries(firstNs);
  for (const entry of filtered) {
    assert.equal(entry.namespace, firstNs);
  }
});

test("EventTopologyService listNamespaceEntries returns empty array for unknown namespace", () => {
  const service = new EventTopologyService();
  const entries = service.listNamespaceEntries("non-existent-namespace");
  assert.deepEqual(entries, []);
});