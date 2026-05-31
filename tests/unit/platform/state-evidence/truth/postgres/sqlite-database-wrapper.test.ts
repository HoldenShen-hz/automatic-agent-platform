import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabaseWrapper } from "../../../../../../src/platform/five-plane-state-evidence/truth/postgres/sqlite-database-wrapper.js";

test("SqliteDatabaseWrapper implements AuthoritativeSqlDatabase interface", () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
  assert.equal(wrapper.backendType, "postgres");
  assert.equal(typeof wrapper.migrate, "function");
  assert.equal(typeof wrapper.getSchemaStatus, "function");
  assert.equal(typeof wrapper.assertSchemaCurrent, "function");
  assert.equal(typeof wrapper.integrityCheck, "function");
  assert.equal(typeof wrapper.healthCheck, "function");
  assert.equal(typeof wrapper.transaction, "function");
  assert.equal(typeof wrapper.readTransaction, "function");
  assert.equal(typeof wrapper.close, "function");
});

test("SqliteDatabaseWrapper backendType is postgres", () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
  assert.equal(wrapper.backendType, "postgres");
});

test("SqliteDatabaseWrapper filePath uses postgres schema", () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) }, "myschema");
  assert.equal(wrapper.filePath, "postgres://myschema");
});

test("SqliteDatabaseWrapper migrate is a no-op", () => {
  assert.doesNotThrow(() => {
    const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
    wrapper.migrate(); // Should not throw
  });
});

test("SqliteDatabaseWrapper getSchemaStatus returns compatible structure", () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
  const status = wrapper.getSchemaStatus();
  assert.equal(status.currentVersion, 0);
  assert.equal(status.expectedVersion, 0);
  assert.equal(status.upToDate, true);
  assert.deepEqual(status.pendingVersions, []);
  assert.deepEqual(status.checksumMismatches, []);
});

test("SqliteDatabaseWrapper assertSchemaCurrent is a no-op", () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
  wrapper.assertSchemaCurrent(); // Should not throw
});

test("SqliteDatabaseWrapper integrityCheck returns empty array", () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
  assert.deepEqual(wrapper.integrityCheck(), []);
});

test("SqliteDatabaseWrapper healthCheck returns true when SELECT 1 succeeds", async () => {
  const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [{ ok: 1 }], run: () => {} }) });
  const result = await wrapper.healthCheck();
  assert.equal(result, true);
});

test("SqliteDatabaseWrapper close is a no-op", () => {
  assert.doesNotThrow(() => {
    const wrapper = new SqliteDatabaseWrapper({ exec: () => {}, prepare: () => ({ all: () => [], run: () => {} }) });
    wrapper.close(); // Should not throw
  });
});

test("SqliteDatabaseWrapper prepare.get falls back to the first row", () => {
  const wrapper = new SqliteDatabaseWrapper({
    exec: () => {},
    prepare: () => ({
      all: () => [{ value: 1 }, { value: 2 }],
      run: () => {},
    }),
  });

  const row = wrapper.connection.prepare("SELECT 1").get();
  assert.deepEqual(row, { value: 1 });
});

test("SqliteDatabaseWrapper nested transaction uses savepoints", () => {
  const statements: string[] = [];
  const wrapper = new SqliteDatabaseWrapper({
    exec: (sql) => { statements.push(sql); },
    prepare: () => ({ all: () => [], run: () => {} }),
  });

  wrapper.transaction(() => {
    wrapper.transaction(() => undefined);
    return undefined;
  });

  assert.deepEqual(statements, ["BEGIN", 'SAVEPOINT "aa_sp_2"', 'RELEASE SAVEPOINT "aa_sp_2"', "COMMIT"]);
});
