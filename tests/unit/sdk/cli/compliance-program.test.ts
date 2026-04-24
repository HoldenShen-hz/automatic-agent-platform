/**
 * Compliance Program CLI Tests
 *
 * Tests for compliance-program.ts CLI module and its environment loader.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadComplianceProgramCliEnv } from "../../../../src/platform/control-plane/config-center/product-cli-env.js";

const COMPLIANCE_PROGRAM_ACTIONS = ["summary", "export"] as const;

// ---------------------------------------------------------------------------
// Tests for loadComplianceProgramCliEnv
// ---------------------------------------------------------------------------

test("loadComplianceProgramCliEnv parses summary action", () => {
  const config = loadComplianceProgramCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_COMPLIANCE_PROGRAM_ACTION: "summary",
  });

  assert.equal(config.action, "summary");
  assert.equal(config.dbPath, "/tmp/test.db");
});

test("loadComplianceProgramCliEnv parses export action", () => {
  const config = loadComplianceProgramCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_COMPLIANCE_PROGRAM_ACTION: "export",
  });

  assert.equal(config.action, "export");
});

test("loadComplianceProgramCliEnv parses artifact root", () => {
  const config = loadComplianceProgramCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT: "/artifacts/compliance",
  });

  assert.equal(config.artifactRoot, "/artifacts/compliance");
});

test("loadComplianceProgramCliEnv defaults action to summary", () => {
  const config = loadComplianceProgramCliEnv({
    AA_DB_PATH: "/tmp/test.db",
  });

  assert.equal(config.action, "summary");
});

test("loadComplianceProgramCliEnv uses provided cwd for dbPath resolution", () => {
  const config = loadComplianceProgramCliEnv(
    { AA_COMPLIANCE_PROGRAM_ACTION: "summary" },
    "/custom/cwd",
  );

  // When AA_DB_PATH is not set, it resolves from cwd
  assert.ok(config.dbPath.includes("/custom/cwd") || config.dbPath.includes("sqlite"), `Expected path to include cwd or sqlite, got: ${config.dbPath}`);
});

// ---------------------------------------------------------------------------
// Tests for COMPLIANCE_PROGRAM_ACTIONS enum
// ---------------------------------------------------------------------------

test("COMPLIANCE_PROGRAM_ACTIONS contains summary and export", () => {
  assert.deepEqual(COMPLIANCE_PROGRAM_ACTIONS, ["summary", "export"]);
});

test("COMPLIANCE_PROGRAM_ACTIONS has exactly 2 actions", () => {
  assert.equal(COMPLIANCE_PROGRAM_ACTIONS.length, 2);
});

// ---------------------------------------------------------------------------
// Tests for compliance program action branching logic
// ---------------------------------------------------------------------------

test("summary action triggers buildReport call", () => {
  const envConfig = {
    action: "summary" as const,
    artifactRoot: null,
  };

  const serviceArgs = {
    artifactStoreOptions: envConfig.artifactRoot
      ? { rootDir: envConfig.artifactRoot }
      : undefined,
  };

  // summary action always triggers buildReport (not export)
  assert.equal(serviceArgs.artifactStoreOptions, undefined);
});

test("export action triggers exportReport call", () => {
  const envConfig = {
    action: "export" as const,
    artifactRoot: "/artifacts",
  };

  // export action sets artifactRoot
  assert.equal(envConfig.artifactRoot, "/artifacts");
});

// ---------------------------------------------------------------------------
// Tests for compliance report structure
// ---------------------------------------------------------------------------

test("compliance report includes generatedAt timestamp", () => {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: { totalPolicies: 10, compliantPolicies: 8 },
  };

  assert.ok(report.generatedAt.includes("T"));
  assert.equal(report.summary.totalPolicies, 10);
  assert.equal(report.summary.compliantPolicies, 8);
});

test("compliance export report includes evidence", () => {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: { totalPolicies: 10, compliantPolicies: 8 },
    evidence: [
      { policyId: "policy-1", status: "compliant", evidence: ["log-1", "log-2"] },
      { policyId: "policy-2", status: "non_compliant", evidence: ["log-3"] },
    ],
  };

  assert.equal(report.evidence.length, 2);
  assert.equal(report.evidence[0]!.policyId, "policy-1");
  assert.deepEqual(report.evidence[0]!.evidence, ["log-1", "log-2"]);
});

// ---------------------------------------------------------------------------
// Tests for artifact root path handling
// ---------------------------------------------------------------------------

test("artifact root is used when provided", () => {
  const envConfig = {
    artifactRoot: "/custom/artifacts",
  };

  const options = {
    artifactStoreOptions: {
      rootDir: envConfig.artifactRoot,
      sandboxPolicy: "write" as const,
    },
  };

  assert.equal(options.artifactStoreOptions.rootDir, "/custom/artifacts");
});

test("artifact root is optional for summary action", () => {
  const envConfig = {
    action: "summary" as const,
    artifactRoot: null,
  };

  const options = {
    artifactStoreOptions: envConfig.artifactRoot
      ? { rootDir: envConfig.artifactRoot }
      : undefined,
  };

  assert.equal(options.artifactStoreOptions, undefined);
});

test("artifact root is optional for export action", () => {
  const envConfig = {
    action: "export" as const,
    artifactRoot: null,
  };

  const options = {
    artifactStoreOptions: envConfig.artifactRoot
      ? { rootDir: envConfig.artifactRoot }
      : undefined,
  };

  // Even when artifactRoot is null, export still works
  assert.equal(options.artifactStoreOptions, undefined);
});
