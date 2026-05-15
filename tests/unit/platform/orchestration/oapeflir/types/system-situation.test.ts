import test from "node:test";
import assert from "node:assert/strict";

import {
  SystemSituationSchema,
  parseSystemSituation,
  type SystemSituation,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/system-situation.js";

test("SystemSituationSchema parses valid system situation", () => {
  const validData: SystemSituation = {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 0.99,
      recentCalls: 100,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 45.5,
      activeProcesses: 10,
    },
    queueBacklog: {
      size: 5,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 2,
    },
    findings: [],
    observedAt: Date.now(),
  };

  const result = SystemSituationSchema.parse(validData);
  assert.equal(result.healthStatus, "ok");
  assert.equal(result.providerHealth.status, "healthy");
  assert.equal(result.resourceUtilization.memoryRssMb, 512);
  assert.equal(result.queueBacklog.size, 5);
});

test("SystemSituationSchema applies defaults", () => {
  const minimalData = {
    healthStatus: "ok" as const,
    observedAt: 1234567890,
  };

  const result = SystemSituationSchema.parse(minimalData);
  assert.deepEqual(result.providerHealth, {
    status: "healthy",
    successRate: 1,
    recentCalls: 0,
  });
  assert.deepEqual(result.resourceUtilization, {
    memoryRssMb: 0,
    activeProcesses: 0,
  });
  assert.deepEqual(result.queueBacklog, {
    size: 0,
    degraded: false,
  });
  assert.deepEqual(result.eventBusBacklog, {
    tier1PendingAcks: 0,
  });
  assert.deepEqual(result.findings, []);
});

test("SystemSituationSchema accepts degraded health status", () => {
  const data = {
    healthStatus: "degraded" as const,
    observedAt: Date.now(),
  };

  const result = SystemSituationSchema.parse(data);
  assert.equal(result.healthStatus, "degraded");
});

test("SystemSituationSchema accepts overloaded health status", () => {
  const data = {
    healthStatus: "overloaded" as const,
    observedAt: Date.now(),
  };

  const result = SystemSituationSchema.parse(data);
  assert.equal(result.healthStatus, "overloaded");
});

test("SystemSituationSchema accepts unhealthy health status", () => {
  const data = {
    healthStatus: "unhealthy" as const,
    observedAt: Date.now(),
  };

  const result = SystemSituationSchema.parse(data);
  assert.equal(result.healthStatus, "unhealthy");
});

test("SystemSituationSchema rejects invalid health status", () => {
  assert.throws(() => {
    SystemSituationSchema.parse({
      healthStatus: "invalid_status",
      observedAt: Date.now(),
    });
  });
});

test("SystemSituationSchema rejects invalid provider health status", () => {
  assert.throws(() => {
    SystemSituationSchema.parse({
      healthStatus: "ok",
      providerHealth: {
        status: "invalid",
        successRate: 0.9,
        recentCalls: 10,
      },
      observedAt: Date.now(),
    });
  });
});

test("SystemSituationSchema rejects successRate out of range", () => {
  assert.throws(() => {
    SystemSituationSchema.parse({
      healthStatus: "ok",
      providerHealth: {
        status: "healthy",
        successRate: 1.5,
        recentCalls: 10,
      },
      observedAt: Date.now(),
    });
  });
});

test("SystemSituationSchema rejects negative memoryRssMb", () => {
  assert.throws(() => {
    SystemSituationSchema.parse({
      healthStatus: "ok",
      resourceUtilization: {
        memoryRssMb: -100,
        activeProcesses: 5,
      },
      observedAt: Date.now(),
    });
  });
});

test("SystemSituationSchema rejects negative queue backlog size", () => {
  assert.throws(() => {
    SystemSituationSchema.parse({
      healthStatus: "ok",
      queueBacklog: {
        size: -1,
        degraded: false,
      },
      observedAt: Date.now(),
    });
  });
});

test("SystemSituationSchema rejects negative tier1PendingAcks", () => {
  assert.throws(() => {
    SystemSituationSchema.parse({
      healthStatus: "ok",
      eventBusBacklog: {
        tier1PendingAcks: -5,
      },
      observedAt: Date.now(),
    });
  });
});

test("parseSystemSituation returns parsed SystemSituation", () => {
  const input = {
    healthStatus: "ok" as const,
    observedAt: 1234567890,
  };

  const result = parseSystemSituation(input);
  assert.equal(result.healthStatus, "ok");
  assert.equal(result.observedAt, 1234567890);
});

test("parseSystemSituation throws on invalid input", () => {
  assert.throws(() => {
    parseSystemSituation({
      healthStatus: "invalid",
      observedAt: Date.now(),
    });
  });
});

test("SystemSituationSchema accepts findings array with entries", () => {
  const data = {
    healthStatus: "degraded",
    findings: [
      "High memory usage detected",
      "Provider success rate below threshold",
    ],
    observedAt: Date.now(),
  };

  const result = SystemSituationSchema.parse(data);
  assert.equal(result.findings.length, 2);
  assert.equal(result.findings[0], "High memory usage detected");
});

test("SystemSituationSchema accepts cpuPercent undefined", () => {
  const data = {
    healthStatus: "ok",
    resourceUtilization: {
      memoryRssMb: 256,
      activeProcesses: 5,
    },
    observedAt: Date.now(),
  };

  const result = SystemSituationSchema.parse(data);
  assert.equal(result.resourceUtilization.cpuPercent, undefined);
});
