import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSqliteMigrationCompatibility, } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-migration-compatibility.js";
import { SQLITE_MIGRATIONS } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-migration-plan.js";
test("sqlite migration compatibility validator passes the current migration plan", () => {
    const report = evaluateSqliteMigrationCompatibility(SQLITE_MIGRATIONS);
    assert.equal(report.compatible, true);
    assert.equal(report.issueCount, 0);
    assert.equal(report.migrationCount, SQLITE_MIGRATIONS.length);
    assert.ok(report.statementCount >= SQLITE_MIGRATIONS.length);
});
test("sqlite migration compatibility validator flags SQLite-only runtime and vendor statements", () => {
    const report = evaluateSqliteMigrationCompatibility([
        {
            version: 1,
            name: "0001_bad_sqlite_vendor_sql",
            sql: `
PRAGMA foreign_keys = ON;
CREATE TABLE demo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
VACUUM;
`,
            checksum: "bad",
        },
    ]);
    assert.equal(report.compatible, false);
    assert.equal(report.issueCount >= 3, true);
    assert.ok(report.issues.some((issue) => issue.ruleId === "sqlite_runtime_pragmas_stay_outside_migrations"));
    assert.ok(report.issues.some((issue) => issue.ruleId === "sqlite_autoincrement_is_not_used"));
    assert.ok(report.issues.some((issue) => issue.ruleId === "sqlite_vacuum_is_not_used"));
});
test("sqlite migration compatibility validator accepts safe migration statements", () => {
    const report = evaluateSqliteMigrationCompatibility([
        {
            version: 1,
            name: "0001_safe_create_table",
            sql: `
CREATE TABLE IF NOT EXISTS demo (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_demo_name ON demo(name);
`,
            checksum: "safe",
        },
    ]);
    assert.equal(report.compatible, true);
    assert.equal(report.issueCount, 0);
});
test("sqlite migration compatibility validator detects ATTACH DATABASE", () => {
    const report = evaluateSqliteMigrationCompatibility([
        {
            version: 1,
            name: "0001_cross_db_reference",
            sql: `
ATTACH DATABASE '/path/to/other.db' AS other;
`,
            checksum: "cross-db",
        },
    ]);
    assert.equal(report.compatible, false);
    assert.ok(report.issues.some((issue) => issue.ruleId === "sqlite_attach_detach_is_not_used"));
});
//# sourceMappingURL=sqlite-migration-compatibility.test.js.map