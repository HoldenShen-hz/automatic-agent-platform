#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const divisionsRoot = "divisions";
const divisionCatalog = JSON.parse(readText("config/quality/division-catalog.json"));
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
  const workflowDir = join(divisionDir, "workflows");
  const workflowFiles = existsSync(workflowDir) ? readdirSync(workflowDir).filter((name) => name.endsWith(".yaml")) : [];
  const workflowIds = workflowFiles.map((name) => extractYamlScalar(readText(join(workflowDir, name)), "id")).filter(Boolean);

  check(`${divisionId} declares id`, declaredId != null && declaredId.length > 0, divisionFile);
  check(`${divisionId} declares default_workflow`, defaultWorkflow != null && defaultWorkflow.length > 0, divisionFile);
  check(
    `${divisionId} default workflow id exists`,
    defaultWorkflow != null && workflowIds.includes(defaultWorkflow),
    defaultWorkflow ?? "missing default_workflow",
  );
}

for (const entry of divisionCatalog.divisions) {
  const divisionDir = join(divisionsRoot, entry.divisionId);
  const divisionFile = join(divisionDir, "division.yaml");
  check(`${entry.divisionId} catalog entry exists`, existsSync(divisionFile), divisionFile);
  if (entry.canonicalDivisionId != null) {
    check(
      `${entry.divisionId} canonical division exists`,
      existsSync(join(divisionsRoot, entry.canonicalDivisionId, "division.yaml")),
      entry.canonicalDivisionId,
    );
  }
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
