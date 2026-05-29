import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = process.cwd();
const testsRoot = resolve(repoRoot, "tests");
const tsconfigPath = resolve(repoRoot, "tsconfig.json");
const outputPath = resolve(repoRoot, "tsconfig.coverage-curated.json");

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

const rootConfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
const excludePatterns = (rootConfig.exclude ?? [])
  .filter((pattern) => typeof pattern === "string" && pattern.startsWith("tests/"));
const files = walkFiles(testsRoot)
  .map((path) => relative(repoRoot, path).replaceAll("\\", "/"))
  .filter((path) => path.endsWith(".test.ts"))
  .filter((path) => !matchesAny(path, excludePatterns))
  .sort((left, right) => left.localeCompare(right));

const output = {
  extends: "./tsconfig.build-test.json",
  compilerOptions: {
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

writeFileSync(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
