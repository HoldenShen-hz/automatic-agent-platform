import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const distRoot = resolve(repoRoot, "dist");
const buildSentinel = resolve(distRoot, "src", "index.js");
const forceRebuild = process.env.AA_FORCE_REBUILD === "1";

const SOURCE_ROOTS = [
  "src",
  "config",
  "divisions",
  "scripts",
];

const SOURCE_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.build.json",
];

function walkNewestMtime(path) {
  if (!existsSync(path)) {
    return 0;
  }
  const stat = statSync(path);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    newest = Math.max(newest, walkNewestMtime(join(path, entry.name)));
  }
  return newest;
}

function shouldRebuild() {
  if (forceRebuild || !existsSync(buildSentinel)) {
    return true;
  }
  const newestSourceMtime = Math.max(
    ...SOURCE_ROOTS.map((root) => walkNewestMtime(resolve(repoRoot, root))),
    ...SOURCE_FILES.map((file) => walkNewestMtime(resolve(repoRoot, file))),
  );
  const newestDistMtime = walkNewestMtime(distRoot);
  return newestSourceMtime > newestDistMtime;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!shouldRebuild()) {
  process.stdout.write("[build] dist is up to date; skipping rebuild.\n");
  process.exit(0);
}

run(process.execPath, ["--enable-source-maps", "scripts/clean-dist.mjs"]);
run(process.execPath, ["./node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"]);
