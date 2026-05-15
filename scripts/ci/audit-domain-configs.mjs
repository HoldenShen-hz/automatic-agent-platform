import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const domainDir = "config/domains";
const requiredTopLevel = [
  "domainId",
  "divisionId",
  "latencyTier",
  "workflowProfile",
  "toolProfile",
  "evalProfile",
  "ownership",
];

const fullContractDomains = new Set([
  "marketing",
  "quant-trading",
  "user-operations",
]);

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateMinimalConfig(path, config) {
  for (const key of requiredTopLevel) {
    check(`${config.domainId ?? path} has ${key}`, Object.prototype.hasOwnProperty.call(config, key), path);
  }
  check(`${config.domainId} required tools`, nonEmptyArray(config.toolProfile?.requiredTools), "toolProfile.requiredTools is non-empty");
  check(`${config.domainId} blocking metrics`, nonEmptyArray(config.evalProfile?.blockingMetrics), "evalProfile.blockingMetrics is non-empty");
  check(`${config.domainId} ownership`, Boolean(config.ownership?.ownerTeam && config.ownership?.escalationTeam), "owner and escalation teams are declared");
}

function validateFullContract(config) {
  const id = config.domainId;
  check(`${id} has name`, typeof config.name === "string" && config.name.length > 0, "name is declared");
  check(`${id} has description`, typeof config.description === "string" && config.description.length > 0, "description is declared");
  check(`${id} active status`, config.status === "active", `status=${config.status}`);
  check(`${id} risk profile`, Boolean(config.riskProfile?.defaultRiskLevel && config.riskProfile?.maxAutonomyLevel), "riskProfile is declared");
  check(`${id} risk spec`, typeof config.riskSpec?.humanAccountable === "boolean", "riskSpec.humanAccountable is declared");
  check(`${id} workflows`, nonEmptyArray(config.workflows), "workflows are declared");
  check(`${id} workflow steps`, config.workflows?.every((workflow) => nonEmptyArray(workflow.steps)), "each workflow has steps");
  check(`${id} tool bundles`, nonEmptyArray(config.toolBundles), "toolBundles are declared");
  check(`${id} output contracts`, nonEmptyArray(config.outputContracts), "outputContracts are declared");
  check(`${id} capabilities`, nonEmptyArray(config.capabilities?.supportedTaskTypes), "capabilities.supportedTaskTypes is non-empty");

  const requiredTools = new Set(config.toolProfile?.requiredTools ?? []);
  const capabilityTools = new Set(config.capabilities?.requiredTools ?? []);
  const bundledTools = new Set(
    (config.toolBundles ?? []).flatMap((bundle) => (bundle.tools ?? []).map((tool) => tool.toolName)),
  );
  const missingFromCapabilities = [...requiredTools].filter((tool) => !capabilityTools.has(tool));
  const missingFromBundles = [...requiredTools].filter((tool) => !bundledTools.has(tool));
  check(`${id} tool profile matches capabilities`, missingFromCapabilities.length === 0, `missing=${missingFromCapabilities.join(",")}`);
  check(`${id} tool profile matches bundles`, missingFromBundles.length === 0, `missing=${missingFromBundles.join(",")}`);
}

for (const entry of readdirSync(domainDir).sort()) {
  if (!entry.endsWith(".json") || entry === "default.json") {
    continue;
  }
  const path = join(domainDir, entry);
  const config = readJson(path);
  validateMinimalConfig(path, config);
  if (fullContractDomains.has(config.domainId)) {
    validateFullContract(config);
  }
}

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`domain config audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`domain config audit passed: ${checks.length}/${checks.length}`);
