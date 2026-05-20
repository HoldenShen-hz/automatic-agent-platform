import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getPlatformArchitectureServices } from "../../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("R28-45 conversation hook uses a shared ConversationClient instead of per-hook useMemo instantiation", () => {
  const source = readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/conversation/src/hooks/index.ts",
    "utf8",
  );

  assert.match(source, /let sharedConversationClient: ConversationClient \| null = null/);
  assert.match(source, /function getSharedConversationClient/);
  assert.doesNotMatch(source, /useMemo\(\(\) => new ConversationClient/);
});

test("R28-47 task cockpit hook rolls back optimistic local mutations when REST updates fail", () => {
  const source = readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/task-cockpit/src/hooks/index.ts",
    "utf8",
  );

  assert.match(source, /const rollback = updateSelected/);
  assert.match(source, /rollback\?\.\(\);/);
});

test("R28-48 security integration test actually injects control characters into the command under test", () => {
  const source = readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/integration/security/input-validation.test.ts",
    "utf8",
  );

  assert.doesNotMatch(source, /const maliciousCommand = "echo";/);
  assert.match(source, /const maliciousCommand = "echo/);
});

test("R28-49 getPlatformArchitectureServices does not re-register catalogs for the same registry instance", async () => {
  const registry = ServiceRegistry.createScoped();
  let registerCalls = 0;
  const originalRegister = registry.register.bind(registry);
  registry.register = ((name: string, registration: unknown) => {
    registerCalls += 1;
    originalRegister(name, registration as never);
  }) as typeof registry.register;

  try {
    getPlatformArchitectureServices(registry);
    getPlatformArchitectureServices(registry);

    assert.equal(registerCalls, 5);
  } finally {
    await registry.reset();
  }
});

test("R28-50 service registry drops stale initialized instances when a service is re-registered", async () => {
  const registry = ServiceRegistry.createScoped();

  try {
    registry.register("reaudit.service", {
      init: () => ({ version: 1 }),
    });
    assert.deepEqual(registry.get<{ version: number }>("reaudit.service"), { version: 1 });

    registry.register("reaudit.service", {
      init: () => ({ version: 2 }),
    });
    assert.deepEqual(registry.get<{ version: number }>("reaudit.service"), { version: 2 });
  } finally {
    await registry.reset();
  }
});

test("R28-53 security defaults add explicit MCP sandbox and rate-limit policy", () => {
  const config = JSON.parse(
    readFileSync(
      "/Users/holden/Project/automatic_agent/automatic_agent_platform/config/security/default.json",
      "utf8",
    ),
  ) as {
    remoteWorkerRegistration?: {
      allowedCapabilities?: string[];
      mcpPolicy?: {
        allowNetworkEgress?: boolean;
        allowedDomains?: unknown[];
        maxRequestsPerMinute?: number;
        sandboxMode?: string;
        allowedTransports?: string[];
      };
    };
  };

  assert.ok(config.remoteWorkerRegistration?.allowedCapabilities?.includes("mcp"));
  assert.deepEqual(config.remoteWorkerRegistration?.mcpPolicy, {
    allowNetworkEgress: false,
    allowedDomains: [],
    maxRequestsPerMinute: 60,
    sandboxMode: "read_only",
    allowedTransports: ["stdio"],
  });
});

test("R28-54 medium-risk defaults require approval and do not auto-execute", () => {
  const config = JSON.parse(
    readFileSync(
      "/Users/holden/Project/automatic_agent/automatic_agent_platform/config/risk/default.json",
      "utf8",
    ),
  ) as {
    riskLevelActions?: {
      medium?: {
        autoExecute?: boolean;
        requiresApproval?: boolean;
      };
    };
  };

  assert.equal(config.riskLevelActions?.medium?.autoExecute, false);
  assert.equal(config.riskLevelActions?.medium?.requiresApproval, true);
});
