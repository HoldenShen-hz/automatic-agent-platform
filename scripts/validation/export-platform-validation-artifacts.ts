import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EVENT_SCHEMA_REGISTRY } from "../../src/platform/five-plane-state-evidence/events/event-registry.js";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const artifactRoot = join(root, "artifacts/validation/platform/contracts");
const registry = readJson(
  "config/validation/platform-validation-registry.json",
) as {
  version: string;
  ciJobs: unknown[];
  gates: unknown[];
  runbooks: unknown[];
};
const metricMap = readJson(
  "config/validation/platform-monitoring-metric-map.json",
);
const lifecycleMatrix = readJson(
  "config/validation/platform-lifecycle-matrix.json",
);

mkdirSync(artifactRoot, { recursive: true });
writeJson("event-registry.canonical.json", {
  version: registry.version,
  events: Object.values(EVENT_SCHEMA_REGISTRY),
});
writeJson("gate-registry.canonical.json", {
  version: registry.version,
  gates: registry.gates,
});
writeJson("ci-job-registry.canonical.json", {
  version: registry.version,
  ciJobs: registry.ciJobs,
});
writeJson("runbook-registry.canonical.yaml", {
  version: registry.version,
  runbooks: registry.runbooks,
});
writeJson("metric-registry.canonical.json", metricMap);
writeJson("lifecycle-matrix.canonical.json", lifecycleMatrix);

console.log(`platform validation artifacts exported: ${artifactRoot}`);

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(
    join(artifactRoot, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}
