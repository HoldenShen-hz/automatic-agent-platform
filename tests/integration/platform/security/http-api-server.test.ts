import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApiAuthService } from "../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { HttpApiServer } from "../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { MissionControlService } from "../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import { GatewayTargetDirectoryService } from "../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { HealthService } from "../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../../../src/platform/shared/observability/metrics-service.js";
import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { OTEL_TEST_ENDPOINT } from "../../../helpers/network-test-constants.js";

test("console html escapes task titles and inspect endpoints require actor headers", async () => {
  const workspace = createTempWorkspace("aa-http-api-security-");
  const dbPath = join(workspace, "security.db");
  const seeded = await runSingleTaskExecution({
    dbPath,
    title: "<script>alert('xss')</script>",
    request: "Render a potentially dangerous title in the console.",
  });
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const gatewayTargets = new GatewayTargetDirectoryService(store);
  gatewayTargets.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "xss-target",
    displayName: "<script>alert('target')</script>",
    aliases: ["target-xss"],
  });
  gatewayTargets.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "finance-east",
    displayName: "Finance East",
    aliases: ["finance"],
  });
  gatewayTargets.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "finance-west",
    displayName: "Finance West",
    aliases: ["finance-team"],
  });
  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "test-api-key",
        actorId: "operator-1",
        roles: ["viewer", "operator", "admin"],
      },
    ],
    jwtSecret: "test-jwt-secret-for-security-tests",
  });

  const server = new HttpApiServer({
    approvalService: new ApprovalService(db, store),
    authService,
    inspectService: inspect,
    missionControlService: new MissionControlService(
      store,
      new HealthService(db, store),
      new MetricsService(db, new HealthService(db, store)),
      inspect,
      {
        gatewayTargetDirectoryService: gatewayTargets,
      },
    ),
    gatewayTargetDirectoryService: gatewayTargets,
  });

  try {
    const consoleHomeUnauthorized = await server.inject({ url: "/console" });
    assert.equal(consoleHomeUnauthorized.statusCode, 401);

    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = tokenResponse.json<{ data: { accessToken: string } }>();
    const accessToken = tokenData.data.accessToken;

    const consoleHome = await server.inject({
      url: "/console",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const consoleHtml = consoleHome.text();
    assert.doesNotMatch(consoleHtml, /<script>alert\('xss'\)<\/script>/);
    assert.match(consoleHtml, /&lt;script&gt;alert\(&#39;xss&#39;\)&lt;\/script&gt;/);

    const taskPage = await server.inject({
      url: `/console/tasks/${seeded.task.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const taskHtml = taskPage.text();
    assert.doesNotMatch(taskHtml, /<script>alert\('xss'\)<\/script>/);
    assert.match(taskHtml, /&lt;script&gt;alert\(&#39;xss&#39;\)&lt;\/script&gt;/);

    const targetsPage = await server.inject({
      url: "/console/targets",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const targetsHtml = targetsPage.text();
    assert.doesNotMatch(targetsHtml, /<script>alert\('target'\)<\/script>/);
    assert.match(targetsHtml, /&lt;script&gt;alert\(&#39;target&#39;\)&lt;\/script&gt;/);

    const inspectResponse = await server.inject({ url: `/v1/tasks/${seeded.task.id}/inspect` });
    assert.equal(inspectResponse.statusCode, 401);
    const inspectPayload = inspectResponse.json<{ error: { code: string } }>();
    assert.equal(inspectPayload.error.code, "api.auth_required");

    const targetsResponse = await server.inject({ url: "/v1/gateway/targets" });
    assert.equal(targetsResponse.statusCode, 401);
    const targetsPayload = targetsResponse.json<{ error: { code: string } }>();
    assert.equal(targetsPayload.error.code, "api.auth_required");

    const ambiguousResolve = await server.inject({
      url: "/v1/gateway/targets/resolve?channel=telegram&query=fin",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    assert.equal(ambiguousResolve.statusCode, 409);
    const ambiguousPayload = ambiguousResolve.json<{ error: { code: string } }>();
    assert.match(ambiguousPayload.error.code, /^gateway\.target_ambiguous(?::.+)?$/);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("api-server CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("api-server.js", {
    AA_DB_PATH: "/tmp/test-postgres-api-server.db",
    AA_CONFIG_ENV: "test",
    AA_CONFIG_ROOT: "/tmp",
    AA_API_PORT: "3000",
    AA_API_HOST: "localhost",
    AA_LOG_STDOUT: "1",
    AA_LOG_FILE_MAX_FILES: "5",
    AA_OTEL_ENABLED: "0",
    AA_OTEL_ENDPOINT: OTEL_TEST_ENDPOINT,
    AA_OTEL_SERVICE_NAME: "test-service",
    AA_OTEL_SERVICE_VERSION: "0.0.0",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.postgres_shadow_sqlite_required_for_async_context/);
});

test("http api server does not leak internal error messages to clients", async () => {
  const workspace = createTempWorkspace("aa-http-api-internal-error-");
  const dbPath = join(workspace, "internal-error.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const server = new HttpApiServer({
    approvalService: new ApprovalService(db, store),
    inspectService: new InspectService(store),
    missionControlService: {
      getSnapshot() {
        throw new Error("postgresql://agent:secret@db.internal/agent_os exploded");
      },
    } as unknown as MissionControlService,
  });

  try {
    const response = await server.inject({ url: "/healthz" });
    assert.equal(response.statusCode, 500);
    const payload = response.json<{ error: { code: string; message: string } }>();
    assert.equal(payload.error.code, "api.internal_error");
    assert.equal(payload.error.message, "Internal server error.");
    assert.doesNotMatch(response.text(), /postgresql:\/\/agent:secret@db\.internal/);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
