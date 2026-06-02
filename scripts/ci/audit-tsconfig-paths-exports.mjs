import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const tsconfig = JSON.parse(readFileSync(resolve("tsconfig.json"), "utf8"));

const exportsMap = typeof packageJson.exports === "object" && packageJson.exports !== null
  ? packageJson.exports
  : {};
const actualPaths = typeof tsconfig.compilerOptions?.paths === "object" && tsconfig.compilerOptions.paths !== null
  ? tsconfig.compilerOptions.paths
  : {};

const expectedPaths = {};
for (const [subpath, target] of Object.entries(exportsMap)) {
  if (subpath === "./package.json" || subpath === "./operator") {
    continue;
  }
  const resolvedTarget = typeof target === "string"
    ? target
    : typeof target?.import === "string"
      ? target.import
      : typeof target?.default === "string"
        ? target.default
        : null;
  if (resolvedTarget == null || !resolvedTarget.startsWith("./dist/src/") || !resolvedTarget.endsWith(".js")) {
    continue;
  }
  const alias = subpath === "."
    ? "automatic-agent-platform"
    : `automatic-agent-platform/${subpath.slice(2)}`;
  expectedPaths[alias] = [resolvedTarget.replace("./dist/src/", "src/").replace(/\.js$/u, ".ts")];
}

const missing = [];
const mismatched = [];
for (const [alias, expectedTarget] of Object.entries(expectedPaths)) {
  const actualTarget = actualPaths[alias];
  if (!Array.isArray(actualTarget)) {
    missing.push(alias);
    continue;
  }
  if (JSON.stringify(actualTarget) !== JSON.stringify(expectedTarget)) {
    mismatched.push({
      alias,
      expected: expectedTarget,
      actual: actualTarget,
    });
  }
}

const unexpected = Object.keys(actualPaths)
  .filter((alias) => alias.startsWith("automatic-agent-platform"))
  .filter((alias) => !(alias in expectedPaths))
  .sort((left, right) => left.localeCompare(right));

const summary = {
  expectedCount: Object.keys(expectedPaths).length,
  actualCount: Object.keys(actualPaths).length,
  missing,
  mismatched,
  unexpected,
};

console.log(JSON.stringify(summary, null, 2));

if (missing.length > 0 || mismatched.length > 0 || unexpected.length > 0) {
  console.error("tsconfig paths drift from package exports");
  process.exit(1);
}
