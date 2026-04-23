import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSqliteSchemaCompatibilityGate } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-schema-compatibility-gate.js";
import { SQLITE_MIGRATIONS } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-migration-plan.js";
test("sqlite schema compatibility gate passes the current migration plan", () => {
    const report = evaluateSqliteSchemaCompatibilityGate(SQLITE_MIGRATIONS);
    assert.equal(report.compatible, true);
    assert.equal(report.issueCount, 0);
    assert.equal(report.migrationCount, SQLITE_MIGRATIONS.length);
});
test("sqlite schema compatibility gate blocks destructive and backward-incompatible statements", () => {
    const report = evaluateSqliteSchemaCompatibilityGate([
        {
            version: 1,
            name: "0001_bad_breaking_change",
            sql: `
ALTER TABLE tasks ADD COLUMN required_flag TEXT NOT NULL;
ALTER TABLE tasks RENAME COLUMN title TO task_title;
DROP TABLE workflow_state;
`,
            checksum: "bad",
        },
    ]);
    assert.equal(report.compatible, false);
    assert.ok(report.issues.some((issue) => issue.ruleId === "add_not_null_column_requires_default"));
    assert.ok(report.issues.some((issue) => issue.ruleId === "column_rename_requires_review"));
    assert.ok(report.issues.some((issue) => issue.ruleId === "destructive_drop_table_is_blocked"));
});
test("sqlite schema compatibility gate allows reviewed tenant-scoped index replacement", () => {
    const report = evaluateSqliteSchemaCompatibilityGate([
        {
            version: 37,
            name: "0037_product_governance_tenant_scope",
            sql: `
DROP INDEX IF EXISTS idx_extension_packages_extension_version;
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_packages_tenant_extension_version
  ON extension_packages(COALESCE(tenant_id, ''), extension_id, version);
`,
            checksum: "safe-index-replacement",
        },
    ]);
    assert.equal(report.compatible, true);
    assert.equal(report.issueCount, 0);
});
test("sqlite schema compatibility gate blocks adding NOT NULL column without default", () => {
    const report = evaluateSqliteSchemaCompatibilityGate([
        {
            version: 1,
            name: "0001_add_not_null_without_default",
            sql: `
ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL;
`,
            checksum: "breaking",
        },
    ]);
    assert.equal(report.compatible, false);
    assert.ok(report.issues.some((issue) => issue.ruleId === "add_not_null_column_requires_default"));
});
test("sqlite schema compatibility gate allows adding nullable column", () => {
    const report = evaluateSqliteSchemaCompatibilityGate([
        {
            version: 1,
            name: "0001_add_nullable_column",
            sql: `
ALTER TABLE tasks ADD COLUMN retry_count INTEGER;
`,
            checksum: "safe",
        },
    ]);
    assert.equal(report.compatible, true);
    assert.equal(report.issueCount, 0);
});
//# sourceMappingURL=sqlite-schema-compatibility-gate.test.js.map