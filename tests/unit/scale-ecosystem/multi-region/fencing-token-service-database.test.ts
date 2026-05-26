import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { FencingTokenService } from "../../../../src/scale-ecosystem/multi-region/fencing-token-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

function createDb(): AuthoritativeSqlDatabase {
  const connection = new DatabaseSync(":memory:");
  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection,
    migrate: () => undefined,
    getSchemaStatus: () => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    assertSchemaCurrent: () => undefined,
    integrityCheck: () => [],
    healthCheck: async () => true,
    close: () => connection.close(),
    transaction: <T>(work: () => T): T => work(),
    readTransaction: <T>(work: () => T): T => work(),
  };
}

test("FencingTokenService persists leadership state in the authoritative SQL database", () => {
  const db = createDb();
  const first = new FencingTokenService({ database: db });
  const token = first.acquireLeadership("us-east", "global");
  assert.ok(token);
  assert.equal(first.releaseLeadership("us-east", "global"), true);

  const restarted = new FencingTokenService({ database: db });
  assert.equal(restarted.getCurrentEpoch(), 1);
  assert.equal(restarted.validateFencingToken("global", token!).reason, "leadership_released");
});
