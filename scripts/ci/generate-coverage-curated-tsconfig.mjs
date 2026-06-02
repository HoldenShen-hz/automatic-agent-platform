import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = process.cwd();
const testsRoot = resolve(repoRoot, "tests");
const allowlistPath = resolve(repoRoot, "config", "quality", "test-exclusion-allowlist.json");
const outputPaths = [
  resolve(repoRoot, "tsconfig.tests-curated.json"),
  resolve(repoRoot, "tsconfig.coverage-curated.json"),
];

function walkFiles(root) {
  const results = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function globToRegExp(pattern) {
  let normalized = pattern.replaceAll("\\", "/");
  normalized = normalized.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  normalized = normalized.replaceAll("/**/", "/(?:.*/)?");
  normalized = normalized.replaceAll("**/", "(?:.*/)?");
  normalized = normalized.replaceAll("/**", "/.*");
  normalized = normalized.replaceAll("**", ".*");
  normalized = normalized.replaceAll("*", "[^/]*");
  return new RegExp(`^${normalized}$`, "u");
}

function matchesAny(path, patterns) {
  const normalized = path.replaceAll("\\", "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
const excludePatterns = Array.isArray(allowlist)
  ? allowlist.filter((pattern) => typeof pattern === "string")
  : [];
const files = walkFiles(testsRoot)
  .map((path) => relative(repoRoot, path).replaceAll("\\", "/"))
  .filter((path) => path.endsWith(".test.ts"))
  .filter((path) => !matchesAny(path, excludePatterns))
  .sort((left, right) => left.localeCompare(right));

const output = {
  extends: "./tsconfig.json",
  compilerOptions: {
    composite: false,
    incremental: false,
    noEmitOnError: false,
  },
  include: [],
  exclude: [
    "dist",
    "node_modules",
  ],
  files,
};

for (const outputPath of outputPaths) {
  writeFileSync(
    outputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
}
