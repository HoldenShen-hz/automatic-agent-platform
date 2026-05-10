import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repoRoot = "/Users/holden/Project/automatic_agent/automatic_agent_platform";

function readDivision(relativePath: string): string {
  return readFileSync(`${repoRoot}/${relativePath}`, "utf8");
}

function extractSection(document: string, sectionName: string): string {
  const pattern = new RegExp(`${sectionName}:\\n((?:^\\s+.*\\n?)*)`, "m");
  const match = document.match(pattern);
  return match?.[1] ?? "";
}

test("analytics/devops/operations monitoring triggers are intentionally partitioned by domain wording and priority", () => {
  const analytics = readDivision("divisions/analytics/division.yaml");
  const devops = readDivision("divisions/devops/division.yaml");
  const operations = readDivision("divisions/operations/division.yaml");
  const analyticsTriggers = extractSection(analytics, "triggers");
  const devopsTriggers = extractSection(devops, "triggers");
  const operationsTriggers = extractSection(operations, "triggers");

  assert.equal(/^\s*-\s*monitoring\s*$/m.test(analyticsTriggers), false);
  assert.equal(/^\s*-\s*monitoring\s*$/m.test(devopsTriggers), true);
  assert.equal(/^\s*-\s*monitoring\s*$/m.test(operationsTriggers), true);
  assert.ok(devops.includes("priority: 45"));
  assert.ok(operations.includes("priority: 20"));
});

test("devops and operations deployment trigger overlap remains visible and priority-driven", () => {
  const devops = readDivision("divisions/devops/division.yaml");
  const operations = readDivision("divisions/operations/division.yaml");

  assert.ok(/^\s*-\s*deployment\s*$/m.test(devops));
  assert.ok(/^\s*-\s*deployment\s*$/m.test(operations));
  assert.ok(devops.includes("description: CI/CD pipelines, infrastructure automation, deployment, monitoring."));
  assert.ok(operations.includes("description: Runbook execution, incident response, and monitoring review for SRE and DevOps tasks."));
  assert.ok(devops.includes("priority: 45"));
  assert.ok(operations.includes("priority: 20"));
});

test("finance-accounting and analytics no longer share a generic reporting trigger", () => {
  const finance = readDivision("divisions/finance-accounting/division.yaml");
  const analytics = readDivision("divisions/analytics/division.yaml");

  assert.equal(/^\s*-\s*reporting\s*$/m.test(finance), false);
  assert.equal(/^\s*-\s*financial reporting\s*$/m.test(finance), true);
  assert.equal(/^\s*-\s*report\s*$/m.test(analytics), true);
});

test("engineering and QA bug routing is explicitly partitioned between bugfix and bug reporting", () => {
  const engineering = readDivision("divisions/engineering_ops/division.yaml");
  const qa = readDivision("divisions/qa/division.yaml");

  assert.equal(/^\s*-\s*bug\s*$/m.test(engineering), false);
  assert.equal(/^\s*-\s*bugfix\s*$/m.test(engineering), true);
  assert.equal(/^\s*-\s*bug\s*$/m.test(qa), true);
});

test("general_ops no longer shadows research-specific trigger vocabulary", () => {
  const generalOps = readDivision("divisions/general_ops/division.yaml");
  const research = readDivision("divisions/research/division.yaml");

  assert.equal(/^\s*-\s*research\s*$/m.test(generalOps), false);
  assert.equal(/^\s*-\s*analyze\s*$/m.test(generalOps), false);
  assert.equal(/^\s*-\s*review\s*$/m.test(generalOps), false);
  assert.equal(/^\s*-\s*research\s*$/m.test(research), true);
  assert.equal(/^\s*-\s*analyze\s*$/m.test(research), true);
  assert.equal(/^\s*-\s*review\s*$/m.test(research), true);
});
