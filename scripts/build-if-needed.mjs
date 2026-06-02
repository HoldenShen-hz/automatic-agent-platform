import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = resolve(repoRoot, "dist");
const buildSentinel = resolve(distRoot, "src", "index.js");
const buildStatePath = resolve(repoRoot, ".cache", "build-if-needed-state.json");
const typeScriptRoot = resolve(repoRoot, "node_modules", "typescript");
const typeScriptCompilerPath = resolve(typeScriptRoot, "lib", "tsc.js");
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

function assertRepoFile(path, label) {
  const normalizedRoot = `${repoRoot}${repoRoot.endsWith("/") ? "" : "/"}`;
  if (path !== repoRoot && !path.startsWith(normalizedRoot)) {
    throw new Error(`${label} must stay within ${repoRoot}: ${path}`);
  }
}

function* walkFiles(path) {
  if (!existsSync(path)) {
    return;
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing symlinked build input: ${path}`);
  }
  if (!stat.isDirectory()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    yield* walkFiles(join(path, entry.name));
  }
}

function computeFileHash(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function computeBuildFingerprint() {
  assertRepoFile(typeScriptCompilerPath, "TypeScript compiler path");
  if (!existsSync(typeScriptCompilerPath)) {
    throw new Error(`TypeScript compiler not found: ${typeScriptCompilerPath}`);
  }
  const hash = createHash("sha256");
  hash.update(`compiler:${typeScriptCompilerPath}:${computeFileHash(typeScriptCompilerPath)}\n`);

  const roots = [
    ...SOURCE_ROOTS.map((root) => resolve(repoRoot, root)),
    ...SOURCE_FILES.map((file) => resolve(repoRoot, file)),
  ].sort((left, right) => left.localeCompare(right));

  for (const root of roots) {
    assertRepoFile(root, "Build input");
    for (const filePath of walkFiles(root)) {
      const relativePath = filePath.slice(repoRoot.length + 1);
      hash.update(`file:${relativePath}\0`);
      hash.update(readFileSync(filePath));
      hash.update("\n");
    }
  }

  return hash.digest("hex");
}

function readPreviousBuildFingerprint() {
  if (!existsSync(buildStatePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(buildStatePath, "utf8"));
    return typeof parsed.buildFingerprint === "string" ? parsed.buildFingerprint : null;
  } catch {
    return null;
  }
}

function writeBuildState(buildFingerprint) {
  mkdirSync(resolve(repoRoot, ".cache"), { recursive: true });
  writeFileSync(
    buildStatePath,
    JSON.stringify(
      {
        buildFingerprint,
        compilerPath: typeScriptCompilerPath,
      },
      null,
      2,
    ),
  );
}

function shouldRebuild() {
  if (forceRebuild || !existsSync(buildSentinel)) {
    return { rebuild: true, buildFingerprint: null };
  }
  const buildFingerprint = computeBuildFingerprint();
  return {
    rebuild: readPreviousBuildFingerprint() !== buildFingerprint,
    buildFingerprint,
  };
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

const buildDecision = shouldRebuild();

if (!buildDecision.rebuild) {
  process.stdout.write("[build] dist is up to date; skipping rebuild.\n");
  process.exit(0);
}

run(process.execPath, ["--enable-source-maps", "scripts/clean-dist.mjs"]);
run(process.execPath, [typeScriptCompilerPath, "-p", "tsconfig.build.json"]);
writeBuildState(buildDecision.buildFingerprint ?? computeBuildFingerprint());
