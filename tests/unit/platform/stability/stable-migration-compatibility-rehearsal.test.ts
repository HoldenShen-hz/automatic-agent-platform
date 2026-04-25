import assert from "node:assert/strict";
import test from "node:test";

import {
  runStableMigrationCompatibilityRehearsal,
  writeStableMigrationCompatibilityRehearsalReport,
} from "../../../../src/platform/stability/stable-migration-compatibility-rehearsal.js";
import {
  evaluateSqliteMigrationCompatibility,
} from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-migration-compatibility.js";

test("evaluateSqliteMigrationCompatibility returns compatible report when migrations are portable", () => {
  const report = evaluateSqliteMigrationCompatibility();

  assert.ok(report.checkedAt.length > 0, "report has checkedAt timestamp");
  assert.ok(Array.isArray(report.checkedRuleIds), "report has checkedRuleIds array");
  assert.ok(report.checkedRuleIds.length > 0, "report checks at least one rule");
  assert.strictEqual(typeof report.migrationCount, "number", "migrationCount is a number");
  assert.strictEqual(typeof report.statementCount, "number", "statementCount is a number");
  assert.strictEqual(typeof report.issueCount, "number", "issueCount is a number");
  assert.ok(Array.isArray(report.issues), "issues is an array");
  assert.ok(Array.isArray(report.migrations), "migrations is an array");
});

test("evaluateSqliteMigrationCompatibility checks all required rule IDs", () => {
  const report = evaluateSqliteMigrationCompatibility();

  const expectedRuleIds = [
    "sqlite_runtime_pragmas_stay_outside_migrations",
    "sqlite_conflict_clauses_are_not_used",
    "sqlite_autoincrement_is_not_used",
    "sqlite_without_rowid_is_not_used",
    "sqlite_attach_detach_is_not_used",
    "sqlite_vacuum_is_not_used",
  ];

  for (const ruleId of expectedRuleIds) {
    assert.ok(
      report.checkedRuleIds.includes(ruleId),
      `report should check rule: ${ruleId}`,
    );
  }
});

test("evaluateSqliteMigrationCompatibility evaluates each migration", () => {
  const report = evaluateSqliteMigrationCompatibility();

  assert.equal(report.migrations.length, report.migrationCount);
  for (const migration of report.migrations) {
    assert.strictEqual(typeof migration.version, "number", "migration has version");
    assert.strictEqual(typeof migration.name, "string", "migration has name");
    assert.strictEqual(typeof migration.compatible, "boolean", "migration has compatible flag");
    assert.strictEqual(typeof migration.statementCount, "number", "migration has statementCount");
    assert.ok(Array.isArray(migration.issues), "migration issues is an array");
  }
});

test("evaluateSqliteMigrationCompatibility identifies non-compatible migrations", () => {
  const report = evaluateSqliteMigrationCompatibility();

  const incompatibleMigrations = report.migrations.filter((m) => !m.compatible);
  for (const migration of incompatibleMigrations) {
    assert.ok(migration.issues.length > 0, `incompatible migration ${migration.name} should have issues`);
    for (const issue of migration.issues) {
      assert.ok(issue.ruleId.length > 0, "issue has ruleId");
      assert.strictEqual(issue.migrationVersion, migration.version, "issue matches migration version");
      assert.strictEqual(issue.migrationName, migration.name, "issue matches migration name");
      assert.ok(issue.detail.length > 0, "issue has detail");
      assert.ok(issue.statement.length > 0, "issue has statement");
    }
  }
});

test("runStableMigrationCompatibilityRehearsal executes all scenarios", async () => {
  const report = await runStableMigrationCompatibilityRehearsal({
    outputDir: "/tmp/stable-migration-compat-test",
  });

  assert.equal(report.totalScenarios, 2, "should have 2 scenarios");
  assert.equal(report.scenarios.length, 2, "should return 2 scenario results");
});

test("runStableMigrationCompatibilityRehearsal returns valid report structure", async () => {
  const report = await runStableMigrationCompatibilityRehearsal({
    outputDir: "/tmp/stable-migration-compat-test-2",
  });

  assert.ok(report.startedAt.length > 0);
  assert.ok(report.finishedAt.length > 0);
  assert.strictEqual(typeof report.totalScenarios, "number");
  assert.strictEqual(typeof report.passedScenarios, "number");
  assert.strictEqual(typeof report.failedScenarios, "number");
  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
  assert.ok(report.outputDir.length > 0);
});

test("runStableMigrationCompatibilityRehearsal scenario has required fields", async () => {
  const report = await runStableMigrationCompatibilityRehearsal({
    outputDir: "/tmp/stable-migration-compat-test-3",
  });

  for (const scenario of report.scenarios) {
    assert.ok(
      ["migration_plan_passes_pg_portability_rules", "sqlite_migration_bootstrap_reaches_latest_schema"].includes(
        scenario.scenarioId,
      ),
      `scenario has valid scenarioId: ${scenario.scenarioId}`,
    );
    assert.strictEqual(typeof scenario.passed, "boolean");
    assert.ok(scenario.durationMs >= 0);
    assert.ok(scenario.summary.length > 0);
    assert.ok(typeof scenario.details === "object");
  }
});

test("runStableMigrationCompatibilityRehearsal scenario 1 checks portability rules", async () => {
  const report = await runStableMigrationCompatibilityRehearsal({
    outputDir: "/tmp/stable-migration-compat-test-4",
  });

  const portabilityScenario = report.scenarios.find(
    (s) => s.scenarioId === "migration_plan_passes_pg_portability_rules",
  );
  assert.ok(portabilityScenario, "should have portability rules scenario");

  const details = portabilityScenario.details;
  assert.strictEqual(typeof (details as Record<string, unknown>).compatible, "boolean");
  assert.strictEqual(typeof (details as Record<string, unknown>).migrationCount, "number");
  assert.strictEqual(typeof (details as Record<string, unknown>).statementCount, "number");
  assert.strictEqual(typeof (details as Record<string, unknown>).issueCount, "number");
});

test("runStableMigrationCompatibilityRehearsal scenario 2 checks sqlite bootstrap", async () => {
  const report = await runStableMigrationCompatibilityRehearsal({
    outputDir: "/tmp/stable-migration-compat-test-5",
  });

  const bootstrapScenario = report.scenarios.find(
    (s) => s.scenarioId === "sqlite_migration_bootstrap_reaches_latest_schema",
  );
  assert.ok(bootstrapScenario, "should have sqlite bootstrap scenario");

  const details = bootstrapScenario.details as Record<string, unknown>;
  assert.ok(details.schemaStatus, "should have schemaStatus in details");
  assert.ok(details.latestVersion, "should have latestVersion in details");
  assert.ok(Array.isArray(details.appliedVersions as unknown[]), "should have appliedVersions array");
});

test("writeStableMigrationCompatibilityRehearsalReport writes valid JSON", () => {
  const report = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:01:00.000Z",
    outputDir: "/tmp/test",
    totalScenarios: 2,
    passedScenarios: 2,
    failedScenarios: 0,
    scenarios: [],
  };

  // Should not throw
  writeStableMigrationCompatibilityRehearsalReport("/tmp/test-migration-report-output.json", report);
});

test("compatible migrations have no issues", () => {
  const report = evaluateSqliteMigrationCompatibility();

  const compatibleMigrations = report.migrations.filter((m) => m.compatible);
  for (const migration of compatibleMigrations) {
    assert.equal(migration.issues.length, 0, `compatible migration ${migration.name} should have 0 issues`);
  }
});
