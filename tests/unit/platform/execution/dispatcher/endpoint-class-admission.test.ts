import assert from "node:assert/strict";
import test from "node:test";

import {
  EndpointClassAdmissionController,
  type EndpointClass,
  type EndpointClassPolicy,
  type EndpointClassSnapshot,
  type EndpointClassAdmissionDecision,
} from "../../../../../src/platform/five-plane-execution/dispatcher/endpoint-class-admission.js";

test("EndpointClassAdmissionController evaluates and accepts read_query [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "read_query", maxQueueDepth: 100, rateLimitPerMinute: 1000 },
    { endpointClass: "create_run", maxQueueDepth: 50, rateLimitPerMinute: 100 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "read_query",
    queueDepthBefore: 10,
    requestsInCurrentMinute: 50,
  };

  const decision = controller.evaluate(snapshot);

  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, "endpoint_class.accepted");
  assert.equal(decision.endpointClass, "read_query");
  assert.equal(decision.queueDepthBefore, 10);
  assert.equal(decision.maxQueueDepth, 100);
  assert.equal(decision.rateLimitPerMinute, 1000);
});

test("EndpointClassAdmissionController rejects when queue depth exceeded [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "read_query", maxQueueDepth: 100, rateLimitPerMinute: 1000 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "read_query",
    queueDepthBefore: 100,
    requestsInCurrentMinute: 50,
  };

  const decision = controller.evaluate(snapshot);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "endpoint_class.queue_depth_exceeded");
  assert.equal(decision.queueDepthBefore, 100);
  assert.equal(decision.maxQueueDepth, 100);
});

test("EndpointClassAdmissionController rejects when rate limit exceeded [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "create_run", maxQueueDepth: 50, rateLimitPerMinute: 100 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "create_run",
    queueDepthBefore: 10,
    requestsInCurrentMinute: 100,
  };

  const decision = controller.evaluate(snapshot);

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "endpoint_class.rate_limit_exceeded");
  assert.equal(decision.requestsInCurrentMinute, 100);
  assert.equal(decision.rateLimitPerMinute, 100);
});

test("EndpointClassAdmissionController throws for unknown endpoint class [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "read_query", maxQueueDepth: 100, rateLimitPerMinute: 1000 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "create_run",
    queueDepthBefore: 10,
    requestsInCurrentMinute: 50,
  };

  assert.throws(
    () => controller.evaluate(snapshot),
    /endpoint_class.policy_missing:create_run/,
  );
});

test("EndpointClass type has all expected values [endpoint-class-admission]", () => {
  const classes: EndpointClass[] = ["read_query", "create_run", "control_command", "event_ingest", "websocket_stream"];
  assert.equal(classes.length, 5);
});

test("EndpointClassPolicy type is usable [endpoint-class-admission]", () => {
  const policy: EndpointClassPolicy = {
    endpointClass: "read_query",
    maxQueueDepth: 100,
    rateLimitPerMinute: 1000,
  };
  assert.equal(policy.endpointClass, "read_query");
  assert.equal(policy.maxQueueDepth, 100);
  assert.equal(policy.rateLimitPerMinute, 1000);
});

test("EndpointClassSnapshot type is usable [endpoint-class-admission]", () => {
  const snapshot: EndpointClassSnapshot = {
    endpointClass: "create_run",
    queueDepthBefore: 25,
    requestsInCurrentMinute: 50,
  };
  assert.equal(snapshot.endpointClass, "create_run");
  assert.equal(snapshot.queueDepthBefore, 25);
  assert.equal(snapshot.requestsInCurrentMinute, 50);
});

test("EndpointClassAdmissionDecision type is usable with all reason codes [endpoint-class-admission]", () => {
  const decisions: EndpointClassAdmissionDecision[] = [
    {
      accepted: true,
      reasonCode: "endpoint_class.accepted",
      endpointClass: "read_query",
      queueDepthBefore: 10,
      maxQueueDepth: 100,
      requestsInCurrentMinute: 50,
      rateLimitPerMinute: 1000,
    },
    {
      accepted: false,
      reasonCode: "endpoint_class.queue_depth_exceeded",
      endpointClass: "read_query",
      queueDepthBefore: 100,
      maxQueueDepth: 100,
      requestsInCurrentMinute: 50,
      rateLimitPerMinute: 1000,
    },
    {
      accepted: false,
      reasonCode: "endpoint_class.rate_limit_exceeded",
      endpointClass: "read_query",
      queueDepthBefore: 10,
      maxQueueDepth: 100,
      requestsInCurrentMinute: 1000,
      rateLimitPerMinute: 1000,
    },
  ];

  assert.equal(decisions.length, 3);
  assert.ok(decisions.every((d) => d.accepted === true || d.accepted === false));
});

test("EndpointClassAdmissionController works with control_command [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "control_command", maxQueueDepth: 20, rateLimitPerMinute: 50 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "control_command",
    queueDepthBefore: 15,
    requestsInCurrentMinute: 30,
  };

  const decision = controller.evaluate(snapshot);
  assert.equal(decision.accepted, true);
});

test("EndpointClassAdmissionController works with event_ingest [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "event_ingest", maxQueueDepth: 500, rateLimitPerMinute: 5000 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "event_ingest",
    queueDepthBefore: 250,
    requestsInCurrentMinute: 2500,
  };

  const decision = controller.evaluate(snapshot);
  assert.equal(decision.accepted, true);
});

test("EndpointClassAdmissionController works with websocket_stream [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "websocket_stream", maxQueueDepth: 1000, rateLimitPerMinute: 10000 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "websocket_stream",
    queueDepthBefore: 500,
    requestsInCurrentMinute: 5000,
  };

  const decision = controller.evaluate(snapshot);
  assert.equal(decision.accepted, true);
});

test("EndpointClassAdmissionController boundary - queue depth exactly at max [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "read_query", maxQueueDepth: 100, rateLimitPerMinute: 1000 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "read_query",
    queueDepthBefore: 99,
    requestsInCurrentMinute: 50,
  };

  const decision = controller.evaluate(snapshot);
  assert.equal(decision.accepted, true);
});

test("EndpointClassAdmissionController boundary - rate limit exactly at max [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "create_run", maxQueueDepth: 50, rateLimitPerMinute: 100 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "create_run",
    queueDepthBefore: 10,
    requestsInCurrentMinute: 99,
  };

  const decision = controller.evaluate(snapshot);
  assert.equal(decision.accepted, true);
});

test("EndpointClassAdmissionController queue depth check takes precedence over rate limit [endpoint-class-admission]", () => {
  const policies: EndpointClassPolicy[] = [
    { endpointClass: "read_query", maxQueueDepth: 100, rateLimitPerMinute: 1000 },
  ];
  const controller = new EndpointClassAdmissionController(policies);

  const snapshot: EndpointClassSnapshot = {
    endpointClass: "read_query",
    queueDepthBefore: 100,
    requestsInCurrentMinute: 1000,
  };

  const decision = controller.evaluate(snapshot);
  // Queue depth check should fail first
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "endpoint_class.queue_depth_exceeded");
});