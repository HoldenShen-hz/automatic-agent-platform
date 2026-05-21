/**
 * Infrastructure: Bounded Dispatch Event Tests
 *
 * Tests for BoundedDispatchQueueEventFactory class that creates
 * bounded dispatch events for queue capacity monitoring.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import {
  BoundedDispatchQueueEventFactory,
  type BoundedDispatchQueueSnapshot,
  type BoundedDispatchEvent,
} from "../../../src/platform/five-plane-execution/queue/bounded-dispatch-event.js";

// ── BoundedDispatchQueueEventFactory Tests ────────────────────────────────────

describe("BoundedDispatchQueueEventFactory", () => {
  let factory: BoundedDispatchQueueEventFactory;

  beforeEach(() => {
    factory = new BoundedDispatchQueueEventFactory();
  });

  describe("create with full input object", () => {
    it("creates accepted event when queue depth below max", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "dispatch-queue",
        queueDepthBefore: 5,
        maxQueueDepth: 10,
        dlqName: "dispatch-queue-dlq",
      };
      const event = factory.create({
        queueName: "dispatch-queue",
        nodeRunId: "node-1",
        tenantId: "tenant-1",
        traceId: "trace-abc",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
      });
      assert.equal(event.eventType, "platform.dispatch.queue.accepted");
      assert.equal(event.queueName, "dispatch-queue");
      assert.equal(event.reasonCode, "queue.accepted");
    });

    it("creates rejected event when queue depth at or above max", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "dispatch-queue",
        queueDepthBefore: 10,
        maxQueueDepth: 10,
        dlqName: "dispatch-queue-dlq",
      };
      const event = factory.create({
        queueName: "dispatch-queue",
        nodeRunId: "node-1",
        tenantId: "tenant-1",
        traceId: "trace-abc",
        orderingPolicyVersion: "1.0",
        queueClass: "standard",
        snapshot,
      });
      assert.equal(event.eventType, "platform.dispatch.queue.rejected");
      assert.equal(event.reasonCode, "queue.max_depth_exceeded");
    });

    it("populates all required fields", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "test-queue",
        queueDepthBefore: 3,
        maxQueueDepth: 20,
        dlqName: "test-dlq",
      };
      const event = factory.create({
        queueName: "test-queue",
        nodeRunId: "node-run-123",
        tenantId: "tenant-456",
        traceId: "trace-789",
        orderingPolicyVersion: "2.0",
        queueClass: "priority",
        snapshot,
      });
      assert.equal(event.nodeRunId, "node-run-123");
      assert.equal(event.tenantId, "tenant-456");
      assert.equal(event.traceId, "trace-789");
      assert.equal(event.orderingPolicyVersion, "2.0");
      assert.equal(event.ordering_policy_version, "2.0");
      assert.equal(event.queueClass, "priority");
      assert.equal(event.queue_class, "priority");
      assert.equal(event.queueDepthBefore, 3);
      assert.equal(event.maxQueueDepth, 20);
      assert.equal(event.dlqName, "test-dlq");
    });

    it("includes optional harnessRunId when provided", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "q",
        queueDepthBefore: 1,
        maxQueueDepth: 10,
        dlqName: "dlq",
      };
      const event = factory.create({
        queueName: "q",
        nodeRunId: "n1",
        tenantId: "t1",
        traceId: "tr1",
        orderingPolicyVersion: "1.0",
        queueClass: "std",
        snapshot,
        harnessRunId: "harness-123",
      });
      assert.equal(event.harnessRunId, "harness-123");
    });

    it("includes optional executionId when provided", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "q",
        queueDepthBefore: 1,
        maxQueueDepth: 10,
        dlqName: "dlq",
      };
      const event = factory.create({
        queueName: "q",
        nodeRunId: "n1",
        tenantId: "t1",
        traceId: "tr1",
        orderingPolicyVersion: "1.0",
        queueClass: "std",
        snapshot,
        executionId: "exec-456",
      });
      assert.equal(event.executionId, "exec-456");
    });

    it("does not include harnessRunId when not provided", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "q",
        queueDepthBefore: 1,
        maxQueueDepth: 10,
        dlqName: "dlq",
      };
      const event = factory.create({
        queueName: "q",
        nodeRunId: "n1",
        tenantId: "t1",
        traceId: "tr1",
        orderingPolicyVersion: "1.0",
        queueClass: "std",
        snapshot,
      });
      assert.equal("harnessRunId" in event, false);
    });
  });

  describe("create with snapshot overload", () => {
    it("creates accepted event when depth below max", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "my-queue",
        queueDepthBefore: 2,
        maxQueueDepth: 5,
        dlqName: "my-dlq",
      };
      const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");
      assert.equal(event.eventType, "platform.dispatch.queue.accepted");
      assert.equal(event.queueName, "my-queue");
    });

    it("creates rejected event when depth exceeds max", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "my-queue",
        queueDepthBefore: 100,
        maxQueueDepth: 50,
        dlqName: "my-dlq",
      };
      const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");
      assert.equal(event.eventType, "platform.dispatch.queue.rejected");
      assert.equal(event.reasonCode, "queue.max_depth_exceeded");
    });

    it("uses queueName as queueClass when using snapshot overload", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "special-queue",
        queueDepthBefore: 0,
        maxQueueDepth: 10,
        dlqName: "special-dlq",
      };
      const event = factory.create(snapshot, "node-1", "tenant-1", "trace-1");
      assert.equal(event.queueClass, "special-queue");
      assert.equal(event.queue_class, "special-queue");
    });

    it("defaults orderingPolicyVersion to 1.0", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "q",
        queueDepthBefore: 0,
        maxQueueDepth: 10,
        dlqName: "dlq",
      };
      const event = factory.create(snapshot, "n1", "t1", "tr1");
      assert.equal(event.orderingPolicyVersion, "1.0");
      assert.equal(event.ordering_policy_version, "1.0");
    });

    it("passes optional harnessRunId and executionId", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "q",
        queueDepthBefore: 0,
        maxQueueDepth: 10,
        dlqName: "dlq",
      };
      const event = factory.create(snapshot, "n1", "t1", "tr1", "harness-1", "exec-1");
      assert.equal(event.harnessRunId, "harness-1");
      assert.equal(event.executionId, "exec-1");
    });

    it("handles undefined optional parameters", () => {
      const snapshot: BoundedDispatchQueueSnapshot = {
        queueName: "q",
        queueDepthBefore: 0,
        maxQueueDepth: 10,
        dlqName: "dlq",
      };
      const event = factory.create(snapshot, "n1", "t1", "tr1", undefined, undefined);
      assert.equal(event.harnessRunId, undefined);
      assert.equal(event.executionId, undefined);
    });
  });
});