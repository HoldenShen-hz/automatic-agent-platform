import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("R19-44 keeps execution outcome evaluation on contracts/local types only", () => {
  const source = readSource("src/platform/prompt-engine/eval/execution-outcome-evaluator.ts");

  assert.equal(source.includes("scale-ecosystem"), false);
  assert.equal(source.includes("feedback-loop"), false);
  assert.match(source, /contracts\/types\/feedback\.js/);
});

test("R19-45 uses HealthReportProvider instead of direct evidence-layer HealthService construction", () => {
  const source = readSource("src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts");

  assert.match(source, /HealthReportProvider/);
  assert.match(source, /createNoOpHealthReportProvider/);
  assert.equal(source.includes("new HealthService("), false);
});

test("R19-46 routes model governance imports through contracts", () => {
  const source = readSource("src/platform/model-gateway/provider-registry/model-routing-service.ts");

  assert.match(source, /contracts\/types\/governance\.js/);
  assert.equal(source.includes("prompt-engine/eval"), false);
});

test("R19-47 ships a dispatch projection that handles dispatch ticket lifecycle events", () => {
  const source = readSource("src/platform/five-plane-state-evidence/events/projections/dispatch-projection.ts");

  assert.match(source, /dispatch:ticket_created/);
  assert.match(source, /dispatch:ticket_claimed/);
  assert.match(source, /dispatch:decision_recorded/);
});
