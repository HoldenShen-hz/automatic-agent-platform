import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EndpointClassAdmissionController,
  type EndpointClassSnapshot,
} from "../../../../../src/platform/five-plane-execution/dispatcher/endpoint-class-admission.js";

describe("EndpointClassAdmissionController", () => {
  describe("evaluate", () => {
    it("should accept request when queue depth and rate limit are within policy", () => {
      const controller = new EndpointClassAdmissionController([
        {
          endpointClass: "create_run",
          maxQueueDepth: 10,
          rateLimitPerMinute: 100,
        },
      ]);

      const snapshot: EndpointClassSnapshot = {
        endpointClass: "create_run",
        queueDepthBefore: 5,
        requestsInCurrentMinute: 50,
      };

      const decision = controller.evaluate(snapshot);

      assert.equal(decision.accepted, true);
      assert.equal(decision.reasonCode, "endpoint_class.accepted");
      assert.equal(decision.maxQueueDepth, 10);
      assert.equal(decision.rateLimitPerMinute, 100);
    });

    it("should reject when queue depth exceeds max", () => {
      const controller = new EndpointClassAdmissionController([
        {
          endpointClass: "create_run",
          maxQueueDepth: 10,
          rateLimitPerMinute: 100,
        },
      ]);

      const snapshot: EndpointClassSnapshot = {
        endpointClass: "create_run",
        queueDepthBefore: 10,
        requestsInCurrentMinute: 50,
      };

      const decision = controller.evaluate(snapshot);

      assert.equal(decision.accepted, false);
      assert.equal(decision.reasonCode, "endpoint_class.queue_depth_exceeded");
    });

    it("should reject when rate limit is exceeded", () => {
      const controller = new EndpointClassAdmissionController([
        {
          endpointClass: "create_run",
          maxQueueDepth: 10,
          rateLimitPerMinute: 100,
        },
      ]);

      const snapshot: EndpointClassSnapshot = {
        endpointClass: "create_run",
        queueDepthBefore: 5,
        requestsInCurrentMinute: 100,
      };

      const decision = controller.evaluate(snapshot);

      assert.equal(decision.accepted, false);
      assert.equal(decision.reasonCode, "endpoint_class.rate_limit_exceeded");
    });

    it("should throw when policy is missing for endpoint class", () => {
      const controller = new EndpointClassAdmissionController([]);

      const snapshot: EndpointClassSnapshot = {
        endpointClass: "create_run",
        queueDepthBefore: 5,
        requestsInCurrentMinute: 50,
      };

      assert.throws(
        () => controller.evaluate(snapshot),
        /endpoint_class.policy_missing/,
      );
    });

    it("should accept at exactly maxQueueDepth - 1", () => {
      const controller = new EndpointClassAdmissionController([
        {
          endpointClass: "read_query",
          maxQueueDepth: 5,
          rateLimitPerMinute: 60,
        },
      ]);

      const snapshot: EndpointClassSnapshot = {
        endpointClass: "read_query",
        queueDepthBefore: 4,
        requestsInCurrentMinute: 30,
      };

      const decision = controller.evaluate(snapshot);

      assert.equal(decision.accepted, true);
      assert.equal(decision.reasonCode, "endpoint_class.accepted");
    });

    it("should reject at maxQueueDepth", () => {
      const controller = new EndpointClassAdmissionController([
        {
          endpointClass: "read_query",
          maxQueueDepth: 5,
          rateLimitPerMinute: 60,
        },
      ]);

      const snapshot: EndpointClassSnapshot = {
        endpointClass: "read_query",
        queueDepthBefore: 5,
        requestsInCurrentMinute: 30,
      };

      const decision = controller.evaluate(snapshot);

      assert.equal(decision.accepted, false);
      assert.equal(decision.reasonCode, "endpoint_class.queue_depth_exceeded");
    });

    it("should evaluate multiple endpoint classes independently", () => {
      const controller = new EndpointClassAdmissionController([
        { endpointClass: "read_query", maxQueueDepth: 5, rateLimitPerMinute: 60 },
        { endpointClass: "create_run", maxQueueDepth: 10, rateLimitPerMinute: 100 },
      ]);

      const readSnapshot: EndpointClassSnapshot = {
        endpointClass: "read_query",
        queueDepthBefore: 4,
        requestsInCurrentMinute: 30,
      };

      const runSnapshot: EndpointClassSnapshot = {
        endpointClass: "create_run",
        queueDepthBefore: 9,
        requestsInCurrentMinute: 99,
      };

      const readDecision = controller.evaluate(readSnapshot);
      const runDecision = controller.evaluate(runSnapshot);

      assert.equal(readDecision.accepted, true);
      assert.equal(readDecision.endpointClass, "read_query");
      assert.equal(runDecision.accepted, true);
      assert.equal(runDecision.endpointClass, "create_run");
    });
  });
});