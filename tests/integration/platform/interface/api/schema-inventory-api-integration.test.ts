import assert from "node:assert/strict";
import test from "node:test";

import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

test("integration: admin schema inventory endpoint exposes authoritative logical table summary", async () => {
  const workspace = createTempWorkspace("aa-schema-api-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenPayload = tokenResponse.json<{ data: { accessToken: string } }>();

    const response = await server.inject({
      url: "/v1/admin/inventories/schema",
      headers: {
        authorization: `Bearer ${tokenPayload.data.accessToken}`,
      },
    });
    const payload = response.json<{
      data: {
        summary: { totalTables: number; byCategory: Record<string, number>; byDocumentedGroup: Record<string, number> };
        tables: Array<{ tableName: string; category: string; documentedGroup: string }>;
      };
    }>();

    assert.equal(response.statusCode, 200);
    assert.equal(payload.data.summary.totalTables, 86);
    assert.ok((payload.data.summary.byCategory["core_truth"] ?? 0) > 0);
    assert.ok((payload.data.summary.byDocumentedGroup["workflow_execution"] ?? 0) > 0);
    assert.ok(payload.data.tables.some((table) => table.tableName === "tasks"));
    assert.ok(payload.data.tables.some((table) => table.tableName === "artifacts" && table.documentedGroup === "knowledge_artifact"));
    assert.ok(payload.data.tables.some((table) => table.tableName === "outbox"));
  } finally {
    cleanupPath(workspace);
  }
});
