/**
 * @fileoverview Unit tests for BoundedDispatchQueueEventFactory
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundedDispatchQueueEventFactory,
  type BoundedDispatchQueueSnapshot,
} from "../../../../../src/platform/five-plane-execution/queue/bounded-dispatch-event.js";

function makeSnapshot(overrides: Partial<BoundedDispatchQueueSnapshot> = {}): BoundedDispatchQueueSnapshot {
  return {
    queueName: "test_queue",
    queueDepthBefore: 5,
    maxQueueDepth: 100,
    dlqName: "test_dlq",
    ...overrides,
  };
}

describe("BoundedDispatchQueueEventFactory", () => {
  const factory = new BoundedDispatchQueueEventFactory();

  describe("create with input object signature", () => {
    test("creates accepted event when queue has capacity", () => {
      const snapshot = makeSnapshot({ queueDepthBefore: 5, maxQueueDepth: 100 });
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
        harnessRunId: "harness_1",
        executionId: "exec_1",
      });

      assert.equal(event.eventType, "platform.dispatch.queue.accepted");
      assert.equal(event.queueName, "test_queue");
      assert.equal(event.nodeRunId, "node_1");
      assert.equal(event.tenantId, "tenant_a");
      assert.equal(event.traceId, "trace_1");
      assert.equal(event.queueDepthBefore, 5);
      assert.equal(event.maxQueueDepth, 100);
      assert.equal(event.reasonCode, "queue.accepted");
      assert.equal(event.harnessRunId, "harness_1");
      assert.equal(event.executionId, "exec_1");
    });

    test("creates rejected event when queue is at max depth", () => {
      const snapshot = makeSnapshot({ queueDepthBefore: 100, maxQueueDepth: 100 });
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
      });

      assert.equal(event.eventType, "platform.dispatch.queue.rejected");
      assert.equal(event.reasonCode, "queue.max_depth_exceeded");
    });

    test("omits optional fields when not provided", () => {
      const snapshot = makeSnapshot();
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
      });

      assert.equal(event.harnessRunId, undefined);
      assert.equal(event.executionId, undefined);
    });
  });

  describe("create with positional signature (snapshot overload)", () => {
    test("creates accepted event with positional args", () => {
      const snapshot = makeSnapshot({ queueDepthBefore: 10, maxQueueDepth: 50 });
      const event = factory.create(snapshot, "node_1", "tenant_a", "trace_1");

      assert.equal(event.eventType, "platform.dispatch.queue.accepted");
      assert.equal(event.queueName, "test_queue");
      assert.equal(event.nodeRunId, "node_1");
      assert.equal(event.tenantId, "tenant_a");
      assert.equal(event.traceId, "trace_1");
      assert.equal(event.queueDepthBefore, 10);
    });

    test("applies harnessRunId and executionId via optional positional args", () => {
      const snapshot = makeSnapshot();
      const event = factory.create(snapshot, "node_1", "tenant_a", "trace_1", "harness_1", "exec_1");

      assert.equal(event.harnessRunId, "harness_1");
      assert.equal(event.executionId, "exec_1");
    });

    test("creates rejected event when snapshot depth equals max", () => {
      const snapshot = makeSnapshot({ queueDepthBefore: 100, maxQueueDepth: 100 });
      const event = factory.create(snapshot, "node_1", "tenant_a", "trace_1");

      assert.equal(event.eventType, "platform.dispatch.queue.rejected");
      assert.equal(event.reasonCode, "queue.max_depth_exceeded");
    });
  });

  describe("event properties", () => {
    test("duplicates orderingPolicyVersion to ordering_policy_version", () => {
      const snapshot = makeSnapshot();
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "2.0",
        queueClass: "priority",
        snapshot,
      });

      assert.equal(event.orderingPolicyVersion, "2.0");
      assert.equal(event.ordering_policy_version, "2.0");
    });

    test("duplicates queueClass to queue_class", () => {
      const snapshot = makeSnapshot();
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "1.0",
        queueClass: "express",
        snapshot,
      });

      assert.equal(event.queueClass, "express");
      assert.equal(event.queue_class, "express");
    });

    test("includes dlqName from snapshot", () => {
      const snapshot = makeSnapshot({ dlqName: "my_dlq" });
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
      });

      assert.equal(event.dlqName, "my_dlq");
    });
  });

  describe("snapshot normalization", () => {
    test("uses default orderingPolicyVersion when using positional signature", () => {
      const snapshot = makeSnapshot();
      const event = factory.create(snapshot, "node_1", "tenant_a", "trace_1");

      assert.equal(event.orderingPolicyVersion, "1.0");
    });

    test("uses queueName as default queueClass in positional signature", () => {
      const snapshot = makeSnapshot({ queueName: "my_special_queue" });
      const event = factory.create(snapshot, "node_1", "tenant_a", "trace_1");

      assert.equal(event.queueClass, "my_special_queue");
    });

    test("handles snapshot as first argument in input signature", () => {
      const snapshot = makeSnapshot({ queueName: "direct_snapshot_queue" });
      const event = factory.create({
        queueName: "test_queue",
        nodeRunId: "node_1",
        tenantId: "tenant_a",
        traceId: "trace_1",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
      });

      assert.equal(event.queueName, "test_queue");
      assert.equal(event.queueDepthBefore, 5);
    });
  });
});