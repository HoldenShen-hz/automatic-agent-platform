import test from "node:test";
import assert from "node:assert/strict";

import {
  UnifiedObservationSchema,
  type UnifiedObservation,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/unified-observation.js";

test("UnifiedObservationSchema parses valid unified observation", () => {
  const validData = {
    task: {
      taskId: "task_123",
      timestamp: Date.now(),
    },
    system: {
      healthStatus: "ok",
      providerHealth: {
        status: "healthy",
        successRate: 0.99,
        recentCalls: 50,
      },
      resourceUtilization: {
        memoryRssMb: 256,
        activeProcesses: 5,
      },
      queueBacklog: {
        size: 2,
        degraded: false,
      },
      eventBusBacklog: {
        tier1PendingAcks: 1,
      },
      findings: [],
      observedAt: Date.now(),
    },
    observedAt: Date.now(),
  };

  const result = UnifiedObservationSchema.parse(validData);
  assert.equal(result.system.healthStatus, "ok");
  assert.ok(result.observedAt > 0);
});

test("UnifiedObservationSchema applies defaults for system", () => {
  const data = {
    task: { taskId: "task_456" },
    system: { healthStatus: "degraded" as const, observedAt: 1234567890 },
    observedAt: 1234567890,
  };

  const result = UnifiedObservationSchema.parse(data);
  assert.deepEqual(result.system.providerHealth, {
    status: "healthy",
    successRate: 1,
    recentCalls: 0,
  });
});

test("UnifiedObservationSchema rejects negative observedAt", () => {
  assert.throws(() => {
    UnifiedObservationSchema.parse({
      task: { taskId: "task_789" },
      system: { healthStatus: "ok", observedAt: 0 },
      observedAt: -1,
    });
  });
});

test("UnifiedObservationSchema accepts valid observedAt", () => {
  const data = {
    task: { taskId: "task_test" },
    system: { healthStatus: "ok", observedAt: 1234567890 },
    observedAt: 0,
  };

  const result = UnifiedObservationSchema.parse(data);
  assert.equal(result.observedAt, 0);
});

test("UnifiedObservationSchema rejects string observedAt", () => {
  assert.throws(() => {
    UnifiedObservationSchema.parse({
      task: { taskId: "task_str" },
      system: { healthStatus: "ok", observedAt: 123 },
      observedAt: "not_a_number",
    });
  });
});

test("UnifiedObservationSchema accepts overloaded system health", () => {
  const data = {
    task: { taskId: "task_overload" },
    system: {
      healthStatus: "overloaded",
      observedAt: Date.now(),
    },
    observedAt: Date.now(),
  };

  const result = UnifiedObservationSchema.parse(data);
  assert.equal(result.system.healthStatus, "overloaded");
});

test("UnifiedObservationSchema accepts unhealthy system health", () => {
  const data = {
    task: { taskId: "task_unhealthy" },
    system: {
      healthStatus: "unhealthy",
      observedAt: Date.now(),
    },
    observedAt: Date.now(),
  };

  const result = UnifiedObservationSchema.parse(data);
  assert.equal(result.system.healthStatus, "unhealthy");
});

test("UnifiedObservation type is correctly inferred", () => {
  const observation: UnifiedObservation = {
    task: {
      taskId: "task_type_check",
      timestamp: 1234567890,
    },
    system: {
      healthStatus: "ok",
      observedAt: 1234567890,
    },
    observedAt: 1234567890,
  };

  assert.equal(observation.task.taskId, "task_type_check");
  assert.equal(observation.system.healthStatus, "ok");
});

test("UnifiedObservationSchema works with complex task data", () => {
  const data = {
    task: {
      taskId: "task_complex",
      timestamp: Date.now(),
      objective: "Complex multi-step task",
      currentPhase: "executing",
      userIntent: {
        raw: "execute complex workflow",
        normalized: "execute workflow",
        confidence: 0.95,
      },
      blockers: [],
      codebaseSnapshot: {
        rootPath: "/project",
        fileCount: 100,
        relevantFiles: [],
      },
      environmentContext: {
        nodeVersion: "20.0.0",
        platform: "darwin",
        workingDirectory: "/project",
        availableTools: ["git", "npm", "node"],
      },
      historicalContext: {
        previousTaskIds: ["task_prev"],
        relatedMemoryRefs: ["memory:ref1"],
      },
    },
    system: {
      healthStatus: "ok",
      providerHealth: {
        status: "healthy",
        successRate: 0.999,
        recentCalls: 500,
      },
      resourceUtilization: {
        memoryRssMb: 1024,
        cpuPercent: 65.5,
        activeProcesses: 20,
      },
      queueBacklog: {
        size: 10,
        degraded: false,
      },
      eventBusBacklog: {
        tier1PendingAcks: 3,
      },
      findings: ["Normal operation"],
      observedAt: Date.now(),
    },
    observedAt: Date.now(),
  };

  const result = UnifiedObservationSchema.parse(data);
  assert.equal(result.task.taskId, "task_complex");
  assert.equal(result.system.resourceUtilization.memoryRssMb, 1024);
  assert.equal(result.system.findings[0], "Normal operation");
});

test("UnifiedObservationSchema rejects invalid system health status", () => {
  assert.throws(() => {
    UnifiedObservationSchema.parse({
      task: { taskId: "task_invalid" },
      system: {
        healthStatus: "invalid_status",
        observedAt: Date.now(),
      },
      observedAt: Date.now(),
    });
  });
});
