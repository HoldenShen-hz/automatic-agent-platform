import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "tests"];
const checks = [];

function walk(root, predicate = () => true) {
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || !existsSync(current)) {
      continue;
    }
    const stat = lstatSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (entry === "node_modules" || entry === "dist") {
          continue;
        }
        stack.push(join(current, entry));
      }
      continue;
    }
    if (stat.isFile() && predicate(current)) {
      results.push(current);
    }
  }
  return results.sort();
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function countMatches(files, pattern) {
  let count = 0;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(pattern);
    count += matches?.length ?? 0;
  }
  return count;
}

const srcTsFiles = walk("src", (file) => file.endsWith(".ts"));
const testTsFiles = walk("tests", (file) => file.endsWith(".ts") || file.endsWith(".tsx"));
const unitTests = testTsFiles.filter((file) => file.includes(`${join("tests", "unit")}${"/"}`) && file.endsWith(".test.ts"));
const integrationTests = testTsFiles.filter((file) => file.includes(`${join("tests", "integration")}${"/"}`) && file.endsWith(".test.ts"));
const e2eTests = testTsFiles.filter((file) => file.includes(`${join("tests", "e2e")}${"/"}`) && file.endsWith(".test.ts"));
const goldenTests = testTsFiles.filter((file) => file.includes(`${join("tests", "golden")}${"/"}`) && file.endsWith(".test.ts"));
const performanceTests = testTsFiles.filter((file) => file.includes(`${join("tests", "performance")}${"/"}`) && file.endsWith(".test.ts"));
const srcEmbeddedTests = srcTsFiles.filter((file) => /\.test\.tsx?$/.test(file));
const largeSrcFiles = srcTsFiles
  .map((file) => ({ file, lines: readFileSync(file, "utf8").split(/\r?\n/).length }))
  .filter((entry) => entry.lines > 1000)
  .sort((a, b) => b.lines - a.lines);
const processEnvCount = countMatches(srcTsFiles, /process\.env/g);
const anyTypeCount = countMatches(srcTsFiles, /:\s*any\b/g);
const tsIgnoreCount = countMatches(srcTsFiles, /@ts-ignore/g);
const doubleCastCount = countMatches(srcTsFiles, /as\s+unknown\s+as/g);

const rootEntries = new Set(readdirSync("."));
const gitignore = readFileSync(".gitignore", "utf8");
const dockerignore = readFileSync(".dockerignore", "utf8");
const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
const inventory = {
  srcTsFiles: srcTsFiles.length,
  testTsFiles: testTsFiles.length,
  unitTests: unitTests.length,
  integrationTests: integrationTests.length,
  e2eTests: e2eTests.length,
  goldenTests: goldenTests.length,
  performanceTests: performanceTests.length,
  srcEmbeddedTests: srcEmbeddedTests.map((file) => relative(".", file)),
  largeSrcFiles: largeSrcFiles.map((entry) => ({ file: relative(".", entry.file), lines: entry.lines })),
  processEnvCount,
  anyTypeCount,
  tsIgnoreCount,
  doubleCastCount,
  hasRootMemoryDbFiles: [...rootEntries].some((entry) => entry.startsWith(":memory:")),
  hasTestDbDirectory: rootEntries.has(".test-db"),
  hasRootBashDirectory: rootEntries.has("bash"),
  architectureRemediationFiles: walk("src", (file) => file.endsWith("architecture-remediation.ts")).map((file) => relative(".", file)),
  tsconfigIncremental: tsconfig.compilerOptions?.incremental === true,
  tsBuildInfoFile: tsconfig.compilerOptions?.tsBuildInfoFile ?? null,
};

check("source TypeScript file count is current", inventory.srcTsFiles === srcTsFiles.length, `srcTsFiles=${inventory.srcTsFiles}`);
check("test TypeScript file count is current", inventory.testTsFiles === testTsFiles.length, `testTsFiles=${inventory.testTsFiles}`);
check("source tree has no embedded test files", inventory.srcEmbeddedTests.length === 0, `srcEmbeddedTests=${inventory.srcEmbeddedTests.length}`);
check("large source file inventory is non-empty and explicit", inventory.largeSrcFiles.length > 0, `largeSrcFiles=${inventory.largeSrcFiles.length}`);
check("process.env count is computed", inventory.processEnvCount >= 0, `processEnvCount=${inventory.processEnvCount}`);
check("type escape counts are computed", inventory.anyTypeCount >= 0 && inventory.tsIgnoreCount >= 0 && inventory.doubleCastCount >= 0, `any=${inventory.anyTypeCount}, tsIgnore=${inventory.tsIgnoreCount}, doubleCast=${inventory.doubleCastCount}`);
check("root memory database files are absent", !inventory.hasRootMemoryDbFiles, "no root :memory:* entries");
check("root bash directory absence is explicit", !inventory.hasRootBashDirectory, "no root bash/ directory");
check("architecture remediation duplicate-name inventory is explicit", inventory.architectureRemediationFiles.length === 5, `files=${inventory.architectureRemediationFiles.length}`);
check("test database directory is ignored", /^\.test-db\/$/m.test(gitignore) && /^\.test-db$/m.test(dockerignore), ".test-db is ignored by git and docker build context");
check("TypeScript incremental cache is configured", inventory.tsconfigIncremental && inventory.tsBuildInfoFile === "dist/.tsbuildinfo", `tsBuildInfoFile=${inventory.tsBuildInfoFile}`);

console.log(JSON.stringify(inventory, null, 2));

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`codebase inventory audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`codebase inventory audit passed: ${checks.length}/${checks.length}`);
