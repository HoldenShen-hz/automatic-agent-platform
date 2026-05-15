import assert from "node:assert/strict";
import test from "node:test";

import {
  loadComplianceProgramCliEnv,
  loadEvolutionCliEnv,
  loadHaProgramCliEnv,
  loadPerceptionCliEnv,
  loadPmfCliEnv,
} from "../../../../../src/platform/five-plane-control-plane/config-center/product-cli-env.js";

test("product CLI env loaders derive default db and artifact paths", () => {
  const cwd = "/tmp/aa-product-cli";

  const pmf = loadPmfCliEnv({
    AA_PMF_ACTION: "history",
  }, cwd);
  const perception = loadPerceptionCliEnv({
    AA_PERCEPTION_ACTION: "sources",
  }, cwd);
  const compliance = loadComplianceProgramCliEnv({}, cwd);

  assert.equal(pmf.dbPath, "/tmp/aa-product-cli/data/sqlite/authoritative-demo.db");
  assert.equal(pmf.artifactRoot, "/tmp/aa-product-cli/data/artifacts");
  assert.equal(perception.dbPath, "/tmp/aa-product-cli/data/sqlite/authoritative-demo.db");
  assert.equal(perception.artifactRoot, "/tmp/aa-product-cli/data/artifacts");
  assert.equal(compliance.dbPath, "/tmp/aa-product-cli/data/sqlite/authoritative-demo.db");
});

test("product CLI env loaders parse perception fields and explicit null markers", () => {
  const config = loadPerceptionCliEnv({
    AA_PERCEPTION_ACTION: "brief",
    AA_PERCEPTION_ACCOUNT_ID: "",
    AA_TENANT_ID: "tenant-1",
    AA_SOURCE_IDS_JSON: JSON.stringify(["source-1", "source-2"]),
    AA_BRIEF_LIMIT: "5",
    AA_SOURCES_ENABLED_ONLY: "true",
  });

  assert.equal(config.action, "brief");
  assert.equal(config.accountId, null);
  assert.equal(config.tenantId, "tenant-1");
  assert.deepEqual(config.sourceIds, ["source-1", "source-2"]);
  assert.equal(config.briefLimit, 5);
  assert.equal(config.sourcesEnabledOnly, true);
});

test("product CLI env loaders parse PMF and HA program inputs", () => {
  const pmf = loadPmfCliEnv({
    AA_PMF_ACTION: "report",
    AA_PMF_PROFILE_NAME: "pmf_profile",
    AA_PMF_DIVISION_ID: "",
    AA_PMF_WINDOW_DAYS: "14",
    AA_PMF_LIMIT: "7",
  });
  const ha = loadHaProgramCliEnv({
    AA_DB_PATH: "/tmp/ha.db",
    AA_ENVIRONMENT: "prod",
    AA_HA_PROGRAM_ACTION: "export",
  });

  assert.equal(pmf.profileName, "pmf_profile");
  assert.equal(pmf.divisionId, null);
  assert.equal(pmf.windowDays, 14);
  assert.equal(pmf.limit, 7);
  assert.equal(ha.environment, "prod");
  assert.equal(ha.action, "export");
});

test("product CLI env loaders parse evolution policies and CSV query tools", () => {
  const config = loadEvolutionCliEnv({
    AA_EVOLUTION_ACTION: "propose_experience",
    AA_SCOPE_TYPE: "division",
    AA_SCOPE_REF: "general_ops",
    AA_QUERY_TOOLS: "web_search, todo_write ,question",
    AA_MIN_QUALITY_SCORE: "0.9",
    AA_BASE_POLICY_MAX_TASK_COST_USD: "8.5",
  });

  assert.equal(config.action, "propose_experience");
  assert.equal(config.scopeType, "division");
  assert.equal(config.scopeRef, "general_ops");
  assert.deepEqual(config.queryTools, ["web_search", "todo_write", "question"]);
  assert.equal(config.minQualityScore, 0.9);
  assert.equal(config.basePolicy.maxTaskCostUsd, 8.5);
});

test("product CLI env loaders reject malformed values", () => {
  assert.throws(
    () => loadPmfCliEnv({ AA_PMF_ACTION: "history", AA_PMF_LIMIT: "oops" }),
    /invalid_env:AA_PMF_LIMIT/,
  );

  assert.throws(
    () => loadHaProgramCliEnv({ AA_ENVIRONMENT: "moon" }),
    /invalid_env:AA_ENVIRONMENT/,
  );

  assert.throws(
    () => loadPerceptionCliEnv({ AA_PERCEPTION_ACTION: "sources", AA_SOURCES_ENABLED_ONLY: "yes" }),
    /invalid_env:AA_SOURCES_ENABLED_ONLY/,
  );
});
