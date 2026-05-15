import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const projectionFiles = [
  "src/platform/five-plane-state-evidence/events/projections/approval-queue-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/artifact-catalog-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/dispatch-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/governance-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/incident-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/risk-action-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/tool-usage-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/worker-status-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/workflow-run-projection.ts",
  "src/platform/five-plane-state-evidence/events/projections/workflow-timeline-projection.ts",
];

test("R19-52 routes cost-management exports through contract types only", () => {
  const source = readSource("src/platform/cost-management/index.ts");

  assert.match(source, /contracts\/types\/cost\.js/);
  assert.equal(source.includes("marketplace/cost-estimation-service"), false);
});

test("R20-06 PlanBuilder emits the canonical PlanGraphBundle fields", () => {
  const source = readSource("src/platform/five-plane-orchestration/planner/plan-builder.ts");

  assert.match(source, /createPlanGraphBundle\(/);
  assert.match(source, /planGraphBundleId/);
  assert.match(source, /graphVersion:/);
  assert.match(source, /schedulerPolicy:/);
  assert.match(source, /budgetPlanRef:/);
  assert.match(source, /riskProfile/);
  assert.match(source, /validationReport:/);
});

test("R20-07 projections use bounded Set or Map processed-event indexes", () => {
  for (const file of projectionFiles) {
    const source = readSource(file);

    assert.match(source, /MAX_PROCESSED_EVENT_IDS/);
    assert.ok(
      source.includes("processedEventIds: ReadonlySet<string>") ||
        source.includes("processedEventIds: ReadonlyMap<string, boolean>"),
      `${file} should declare a Set/Map-based processedEventIds index`,
    );
    assert.match(source, /processedEventIds\.has\(eventId\)/);
    assert.ok(
      source.includes("while (processedEventIds.size >= MAX_PROCESSED_EVENT_IDS)") ||
        source.includes("while (newProcessedEventIds.size >= MAX_PROCESSED_EVENT_IDS)"),
      `${file} should evict old processed-event ids when the bounded index is full`,
    );
  }
});

test("R20-08 projections avoid nested-object mutation after shallow cloning", () => {
  const nestedMutationPattern = /(?:newState|state)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+\s*=/;
  const indexedMutationPattern = /(?:newState|state)\.[A-Za-z0-9_]+\[[^\]]+\]\s*=/;

  for (const file of projectionFiles) {
    const source = readSource(file);

    assert.equal(nestedMutationPattern.test(source), false, `${file} should not mutate nested object fields directly`);
    assert.equal(indexedMutationPattern.test(source), false, `${file} should not mutate indexed nested fields directly`);
  }
});

test("R20-50 and R20-51 wire built-in connectors and durable connector storage", () => {
  const source = readSource("src/scale-ecosystem/integration/connector-framework-service.ts");

  assert.match(source, /GitHubConnector/);
  assert.match(source, /SlackConnector/);
  assert.match(source, /JiraConnector/);
  assert.match(source, /ServiceNowConnector/);
  assert.match(source, /createBuiltInConnectorInstance/);
  assert.match(source, /connector-manifests\.json/);
  assert.match(source, /connector-bindings\.json/);
});

test("R20-52 side-effect FSM and contract both include manual review and compensation states", () => {
  const runtimeSource = [
    readSource("src/platform/five-plane-execution/runtime-state-machine.ts"),
    readSource("src/platform/five-plane-execution/runtime-state-machine-model.ts"),
  ].join("\n");
  const contractSource = readSource("docs_zh/contracts/side-effect-reconciliation-contract.md");

  assert.match(runtimeSource, /manual_review_required/);
  assert.match(runtimeSource, /compensation_required/);
  assert.match(contractSource, /manual_review_required/);
  assert.match(contractSource, /compensation_required/);
});
