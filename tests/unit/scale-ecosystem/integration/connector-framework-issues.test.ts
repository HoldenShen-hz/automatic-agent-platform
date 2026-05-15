import assert from "node:assert/strict";
import test from "node:test";

import { ConnectorFrameworkService } from "../../../../src/scale-ecosystem/integration/connector-framework-service.js";

function registerConnector(service: ConnectorFrameworkService, connectorId: string): void {
  service.register({
    connectorId,
    provider: "github",
    capabilities: ["sync"],
    authMode: "oauth2",
    rateLimits: { perMinute: 60 },
    supportedEvents: ["test.event"],
    lifecycleState: "enabled",
  });
  service.bind(connectorId, "tenant-1", "prod", "2026-05-06T00:00:00.000Z");
}

function execute(service: ConnectorFrameworkService, connectorId: string, executedAt = "2026-05-06T00:00:00.000Z") {
  return service.execute(
    {
      connectorId,
      capability: "sync",
      payload: {},
      policyRef: "policy:test",
      secretBindings: [{ secretRef: "secret://token", purpose: "api_token" }],
    },
    { environment: "prod", eventType: "test.event", executedAt },
  );
}

test("connector-framework-2124: opens the circuit after repeated execution failures", async () => {
  const executions: string[] = [];
  const service = new ConnectorFrameworkService({
    executors: {
      "failing-connector": () => {
        executions.push("attempt");
        return {
          connectorId: "failing-connector",
          success: false,
          status: "failed",
        };
      },
    },
  });
  registerConnector(service, "failing-connector");

  for (let index = 0; index < 5; index++) {
    const result = await execute(service, "failing-connector", `2026-05-06T00:00:0${index}.000Z`);
    assert.equal(result.success, false);
  }

  const blocked = await execute(service, "failing-connector", "2026-05-06T00:00:10.000Z");

  assert.equal(blocked.success, false);
  assert.equal(executions.length, 5, "open circuit should fail fast without invoking executor again");
});

test("connector-framework-2124: transitions to half-open after timeout and closes on success", async () => {
  const executions: string[] = [];
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;

  try {
    const service = new ConnectorFrameworkService({
      executors: {
        "recovering-connector": () => {
          executions.push("attempt");
          return {
            connectorId: "recovering-connector",
            success: executions.length > 5,
            status: executions.length > 5 ? "succeeded" : "failed",
          };
        },
      },
    });
    registerConnector(service, "recovering-connector");

    for (let index = 0; index < 5; index++) {
      now = index * 1000;
      await execute(service, "recovering-connector");
    }

    now = 6_000;
    await execute(service, "recovering-connector");
    assert.equal(executions.length, 5, "circuit should still be open before timeout");

    now = 35_001;
    const recovered = await execute(service, "recovering-connector");
    assert.equal(recovered.success, true);
    assert.equal(executions.length, 6, "half-open circuit should allow one recovery probe");

    now = 36_000;
    const closedAgain = await execute(service, "recovering-connector");
    assert.equal(closedAgain.success, true);
    assert.equal(executions.length, 7, "successful half-open probe should close the circuit");
  } finally {
    Date.now = originalNow;
  }
});

test("connector-framework-2124: failed health checks also contribute to opening the circuit", async () => {
  const executions: string[] = [];
  const service = new ConnectorFrameworkService({
    executors: {
      "health-checked-connector": () => {
        executions.push("attempt");
        return {
          connectorId: "health-checked-connector",
          success: true,
          status: "succeeded",
        };
      },
    },
  });
  registerConnector(service, "health-checked-connector");

  for (let index = 0; index < 5; index++) {
    service.recordHealth({
      connectorId: "health-checked-connector",
      status: "failed",
      latencyMs: 5_000,
      checkedAt: `2026-05-06T00:00:0${index}.000Z`,
    });
    await execute(service, "health-checked-connector");
  }

  const blocked = await execute(service, "health-checked-connector");

  assert.equal(blocked.success, false);
  assert.equal(executions.length, 0, "failed health should trip the circuit before executor is invoked");
});
