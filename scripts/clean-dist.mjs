import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const distPath = resolve(repoRoot, "dist");
const tsBuildInfoPath = resolve(repoRoot, ".cache", "tsconfig.tsbuildinfo");
const dryRun = process.argv.includes("--dry-run");
const explicitPreserveDist = process.env.AA_PRESERVE_DIST;
const preserveDist = explicitPreserveDist === "1";

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
  if (dryRun) {
    console.log(`[clean-dist] dry-run: would remove ${distPath}`);
    console.log(`[clean-dist] dry-run: would remove ${tsBuildInfoPath}`);
    process.exit(0);
  }
  try {
    rmSync(distPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  rmSync(tsBuildInfoPath, { force: true });
} else if (shouldPruneStaleDistTests) {
  if (dryRun) {
    console.log("[clean-dist] dry-run: would prune stale dist tests");
    process.exit(0);
  }
  pruneStaleDistTests();
}
