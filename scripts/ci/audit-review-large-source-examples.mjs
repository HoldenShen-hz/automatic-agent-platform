import { readFileSync } from "node:fs";

const checks = [];
const MAX_SOURCE_LINES = 1000;

function lineCount(path) {
  return readFileSync(path, "utf8").split("\n").length;
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const runtimeTruthRepositoryLines = lineCount("src/platform/five-plane-state-evidence/truth/runtime-truth-repository.ts");
const missionRepositoryLines = lineCount("src/platform/five-plane-state-evidence/truth/mission-repository.ts");
const runtimePhysicalSchemaLines = lineCount("src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts");
const platformIndexLines = lineCount("src/platform/index.ts");
const harnessIndexLines = lineCount("src/platform/five-plane-orchestration/harness/index.ts");
const executableContractsIndexLines = lineCount("src/platform/contracts/executable-contracts/index.ts");

check(
  `runtime-truth-repository below ${MAX_SOURCE_LINES} lines`,
  runtimeTruthRepositoryLines < MAX_SOURCE_LINES,
  `runtime-truth-repository.ts=${runtimeTruthRepositoryLines}`,
);
check(
  `mission-repository below ${MAX_SOURCE_LINES} lines`,
  missionRepositoryLines < MAX_SOURCE_LINES,
  `mission-repository.ts=${missionRepositoryLines}`,
);
check(
  `runtime-physical-schema below ${MAX_SOURCE_LINES} lines`,
  runtimePhysicalSchemaLines < MAX_SOURCE_LINES,
  `runtime-physical-schema.ts=${runtimePhysicalSchemaLines}`,
);
check(
  `platform index below ${MAX_SOURCE_LINES} lines`,
  platformIndexLines < MAX_SOURCE_LINES,
  `platform/index.ts=${platformIndexLines}`,
);
check(
  `remaining giant source files stay below ${MAX_SOURCE_LINES} lines`,
  harnessIndexLines <= MAX_SOURCE_LINES && executableContractsIndexLines <= MAX_SOURCE_LINES,
  `harness/index.ts=${harnessIndexLines}, executable-contracts/index.ts=${executableContractsIndexLines}`,
);

for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

const failures = checks.filter((item) => !item.ok);
if (failures.length > 0) {
  console.error(`review large source example audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`review large source example audit passed: ${checks.length}/${checks.length}`);
