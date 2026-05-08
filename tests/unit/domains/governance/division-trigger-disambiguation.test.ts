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
