import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("platform contract export surface stays canonical-first", () => {
  const platformContracts = readFileSync("src/platform/contracts/types/platform-contracts.ts", "utf8");
  assert.doesNotMatch(platformContracts, /createExecutionPlan/);
  assert.doesNotMatch(platformContracts, /createExecutionReceipt/);
  assert.doesNotMatch(platformContracts, /createStateCommand/);
  assert.doesNotMatch(platformContracts, /createControlDirective/);
  assert.doesNotMatch(platformContracts, /interface SideEffectExpectation/);
  assert.doesNotMatch(platformContracts, /interface ExecutionPlanBudget/);
  assert.doesNotMatch(platformContracts, /interface ExecutionReceiptErrorDetail/);

  const typeBarrel = readFileSync("src/platform/contracts/types/index.ts", "utf8");
  assert.match(typeBarrel, /export \* from "\.\/domain\/index\.js";/);
});

test("executable contract json schemas are fail-closed", () => {
  const schemas = readFileSync("src/platform/contracts/executable-contracts/schemas.ts", "utf8");
  assert.match(schemas, /additionalProperties: false/);
});

test("hitl and sdk contracts use canonical runtime references", () => {
  const hitl = readFileSync("docs_zh/contracts/hitl_experience_and_explainability_contract.md", "utf8");
  assert.match(hitl, /NodeAttempt/);
  assert.match(hitl, /NodeRun/);
  assert.doesNotMatch(hitl, /step_retry/);
  assert.doesNotMatch(hitl, /step_output/);
  assert.doesNotMatch(hitl, /指定 step/);

  const sdkSurface = readFileSync("docs_zh/contracts/sdk_surface_contract.md", "utf8");
  assert.match(sdkSurface, /getTaskCockpitByHarnessRunId/);
  assert.match(sdkSurface, /getWorkflowCockpitByHarnessRunId/);
  assert.match(sdkSurface, /getAdminTakeoverConsoleByHarnessRunId/);
  assert.match(sdkSurface, /getTaskCockpitByTaskId/);
});

test("autonomy and budget adr/contracts distinguish interaction autonomy from runtime mode", () => {
  const adr042 = readFileSync("docs_zh/adr/042-progressive-autonomy-model.md", "utf8");
  assert.match(adr042, /suggestion/);
  assert.match(adr042, /frozen/);
  assert.doesNotMatch(adr042, /\| 0 \| manual_only \|/);

  const adr083 = readFileSync("docs_zh/adr/083-proactive-agent-and-progressive-autonomy.md", "utf8");
  assert.match(adr083, /InteractionAutonomyLevel/);
  assert.match(adr083, /UnifiedRuntimeMode/);
  assert.match(adr083, /incident_mode/);

  const opsContract = readFileSync("docs_zh/contracts/platform_ops_agent_contract.md", "utf8");
  assert.match(opsContract, /no_rollout/);
  assert.doesNotMatch(opsContract, /trusted_auto/);
  assert.doesNotMatch(opsContract, /unrestricted_auto/);

  const budgetContract = readFileSync("docs_zh/contracts/cost_and_budget_contract.md", "utf8");
  assert.match(budgetContract, /max_node_runs/);
  assert.match(budgetContract, /no_rollout/);
  assert.doesNotMatch(budgetContract, /no_release/);
});

test("ui adr index and required adr files exist", () => {
  const readme = readFileSync("ui/docs/adr/README.md", "utf8");
  for (const adrId of ["ADR-UI-001", "ADR-UI-002", "ADR-UI-003", "ADR-UI-004", "ADR-UI-005", "ADR-UI-006", "ADR-UI-007", "ADR-UI-008", "ADR-UI-009"]) {
    assert.match(readme, new RegExp(adrId));
  }

  const requiredFiles = [
    "ui/docs/adr/ADR-UI-001-app-shell-and-route-topology.md",
    "ui/docs/adr/ADR-UI-002-mission-control-typed-facade.md",
    "ui/docs/adr/ADR-UI-003-websocket-channel-model.md",
    "ui/docs/adr/ADR-UI-004-auth-session-and-pkce.md",
    "ui/docs/adr/ADR-UI-005-design-token-and-theming.md",
    "ui/docs/adr/ADR-UI-006-feature-module-boundaries.md",
    "ui/docs/adr/ADR-UI-007-workflow-builder-dag-first.md",
    "ui/docs/adr/ADR-UI-008-performance-budget-and-bundle-gate.md",
    "ui/docs/adr/ADR-UI-009-testing-and-accessibility-gates.md",
  ];
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `missing required UI ADR: ${file}`);
    assert.match(readFileSync(file, "utf8"), /^# ADR-UI-/);
  }
});
