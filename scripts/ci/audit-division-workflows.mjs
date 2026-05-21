#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const divisionsRoot = "divisions";
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function extractYamlScalar(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

for (const divisionId of readdirSync(divisionsRoot).sort()) {
  const divisionDir = join(divisionsRoot, divisionId);
  const divisionFile = join(divisionDir, "division.yaml");
  if (!existsSync(divisionFile)) {
    continue;
  }

  const source = readText(divisionFile);
  const declaredId = extractYamlScalar(source, "id");
  const defaultWorkflow = extractYamlScalar(source, "default_workflow");
  const workflowPath = defaultWorkflow == null ? null : join(divisionDir, "workflows", `${defaultWorkflow}.yaml`);

  check(`${divisionId} declares id`, declaredId != null && declaredId.length > 0, divisionFile);
  check(`${divisionId} declares default_workflow`, defaultWorkflow != null && defaultWorkflow.length > 0, divisionFile);
  check(
    `${divisionId} default workflow file exists`,
    workflowPath != null && existsSync(workflowPath),
    workflowPath ?? "missing default_workflow",
  );
}

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`division workflow audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`division workflow audit passed: ${checks.length}/${checks.length}`);
