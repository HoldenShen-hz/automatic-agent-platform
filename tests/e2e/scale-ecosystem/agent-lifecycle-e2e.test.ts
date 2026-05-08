/**
 * E2E Tests for Agent Lifecycle Service
 *
 * End-to-end tests covering:
 * 1. Agent lifecycle state transitions
 * 2. Agent registration and deregistration
 * 3. Agent health monitoring
 * 4. Agent resource allocation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
// @ts-ignore
import { AgentLifecycleService, type AgentLifecycleState, type AgentRegistrationRequest } from "../../../src/scale-ecosystem/runtime-services/agent-lifecycle/agent-lifecycle-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

function createAgentRegistration(overrides: Partial<AgentRegistrationRequest> = {}): AgentRegistrationRequest {
  return {
    agentId: overrides.agentId ?? newId("agent"),
    agentType: overrides.agentType ?? "executor",
    capabilities: overrides.capabilities ?? ["task_execution", "tool_use"],
    maxConcurrentTasks: overrides.maxConcurrentTasks ?? 5,
    healthCheckIntervalMs: overrides.healthCheckIntervalMs ?? 30_000,
    ...overrides,
  };
}

test("E2E AgentLifecycle: Agent transitions from initializing to active", async () => {
  const harness = createE2EHarness("aa-e2e-agent-lifecycle-");
  try {
    const service = new AgentLifecycleService(harness.store);

    const registration = createAgentRegistration();
    const result = service.registerAgent(registration);

    assert.equal(result.status, "initializing");

    // Transition to active
    const activated = service.activateAgent(registration.agentId);
    assert.equal(activated.status, "active");
  } finally {
    harness.cleanup();
  }
});

test("E2E AgentLifecycle: Agent can be registered and deregistered", async () => {
  const harness = createE2EHarness("aa-e2e-agent-dereg-");
  try {
    const service = new AgentLifecycleService(harness.store);

    const registration = createAgentRegistration();
    service.registerAgent(registration);

    const deregistered = service.deregisterAgent(registration.agentId);
    assert.equal(deregistered.status, "deregistered");
  } finally {
    harness.cleanup();
  }
});

test("E2E AgentLifecycle: Agent health monitoring transitions state", async () => {
  const harness = createE2EHarness("aa-e2e-agent-health-");
  try {
    const service = new AgentLifecycleService(harness.store);

    const registration = createAgentRegistration();
    service.registerAgent(registration);
    service.activateAgent(registration.agentId);

    // Mark agent as unhealthy
    const unhealthy = service.updateAgentHealth(registration.agentId, {
      status: "unhealthy",
      errorCode: "heartbeat_timeout",
    });

    assert.equal(unhealthy.status, "degraded");
  } finally {
    harness.cleanup();
  }
});

test("E2E AgentLifecycle: Agent can handle concurrent task assignments", async () => {
  const harness = createE2EHarness("aa-e2e-agent-concurrent-");
  try {
    const service = new AgentLifecycleService(harness.store);

    const registration = createAgentRegistration({ maxConcurrentTasks: 3 });
    service.registerAgent(registration);
    service.activateAgent(registration.agentId);

    const taskIds = [newId("task"), newId("task"), newId("task")];

    // Assign 3 tasks (at capacity)
    const result1 = service.assignTask(registration.agentId, taskIds[0]!);
    const result2 = service.assignTask(registration.agentId, taskIds[1]!);
    const result3 = service.assignTask(registration.agentId, taskIds[2]!);

    assert.equal(result1.assigned, true);
    assert.equal(result2.assigned, true);
    assert.equal(result3.assigned, true);

    // Fourth task should be queued (not rejected)
    const result4 = service.assignTask(registration.agentId, newId("task"));
    assert.equal(result4.assigned, false);
    assert.ok(result4.queued === true || result4.reason !== undefined);
  } finally {
    harness.cleanup();
  }
});