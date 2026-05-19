import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const distPath = resolve(process.cwd(), "dist");
const explicitPreserveDist = process.env.AA_PRESERVE_DIST;
const preserveDist =
  explicitPreserveDist === "1"
  || (
    explicitPreserveDist !== "0"
    && (
      process.env.AA_RUNNING_TESTS === "1"
      || (process.env.npm_lifecycle_event ?? "").startsWith("test")
    )
  )
  || process.env.C8_PROCESS_INFO != null
  || process.env.NODE_V8_COVERAGE != null;

const shouldPruneStaleDistTests =
  preserveDist
  && process.env.AA_PRUNE_DIST_TESTS === "1";

function listFilesRecursively(rootPath) {
  const results = [];
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function pruneStaleDistTests() {
  const distTestsPath = join(distPath, "tests");
  if (!existsSync(distTestsPath)) {
    return;
  }

  for (const filePath of listFilesRecursively(distTestsPath)) {
    if (!filePath.endsWith(".test.js.map")) {
      continue;
    }

    let sourceMap;
    try {
      sourceMap = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }

    const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
    const sourcePaths = sources.map((sourcePath) => resolve(dirname(filePath), sourcePath));
    const hasExistingSource = sourcePaths.some((sourcePath) => existsSync(sourcePath));
    if (hasExistingSource) {
      continue;
    }

    const jsPath = filePath.slice(0, -".map".length);
    const dtsPath = jsPath.replace(/\.js$/, ".d.ts");
    rmSync(filePath, { force: true });
    rmSync(jsPath, { force: true });
    rmSync(dtsPath, { force: true });
  }
}

if (!preserveDist && existsSync(distPath)) {
  try {
    rmSync(distPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT" && err.code !== "ENOTEMPTY") {
      throw err;
    }
  }
} else if (shouldPruneStaleDistTests) {
  pruneStaleDistTests();
}
