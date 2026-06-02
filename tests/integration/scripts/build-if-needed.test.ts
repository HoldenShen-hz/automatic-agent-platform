import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const BUILD_SCRIPT_PATH = join(process.cwd(), "scripts", "build-if-needed.mjs");
const CLEAN_DIST_SCRIPT_PATH = join(process.cwd(), "scripts", "clean-dist.mjs");

test("build-if-needed rebuilds when source content changes even if mtimes move backwards", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-build-if-needed-"));
  const buildScript = join(workspace, "scripts", "build-if-needed.mjs");
  const cleanDistScript = join(workspace, "scripts", "clean-dist.mjs");
  const sourceFile = join(workspace, "src", "index.ts");
  const tscPath = join(workspace, "node_modules", "typescript", "lib", "tsc.js");
  const counterPath = join(workspace, ".cache", "fake-tsc-count.txt");
  const distSentinel = join(workspace, "dist", "src", "index.js");

  try {
    mkdirSync(join(workspace, "scripts"), { recursive: true });
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, "config"), { recursive: true });
    mkdirSync(join(workspace, "divisions"), { recursive: true });
    mkdirSync(join(workspace, ".cache"), { recursive: true });
    mkdirSync(join(workspace, "node_modules", "typescript", "lib"), { recursive: true });
    copyFileSync(BUILD_SCRIPT_PATH, buildScript);
    copyFileSync(CLEAN_DIST_SCRIPT_PATH, cleanDistScript);
    writeFileSync(sourceFile, "export const marker = 'v1';\n");
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ type: "module" }, null, 2));
    writeFileSync(join(workspace, "tsconfig.json"), "{}\n");
    writeFileSync(join(workspace, "tsconfig.build.json"), "{}\n");
    writeFileSync(
      tscPath,
      [
        "import { mkdirSync, readFileSync, writeFileSync } from \"node:fs\";",
        "import { dirname, join } from \"node:path\";",
        "const repoRoot = process.cwd();",
        "const cacheDir = join(repoRoot, \".cache\");",
        "const counterPath = join(cacheDir, \"fake-tsc-count.txt\");",
        "mkdirSync(cacheDir, { recursive: true });",
        "const current = Number.parseInt(readFileSync(counterPath, \"utf8\"), 10) || 0;",
        "const next = current + 1;",
        "writeFileSync(counterPath, String(next));",
        "const distDir = join(repoRoot, \"dist\", \"src\");",
        "mkdirSync(distDir, { recursive: true });",
        "writeFileSync(join(distDir, \"index.js\"), `build:${next}\\n`);",
        "",
      ].join("\n"),
    );
    writeFileSync(counterPath, "0\n");

    const first = spawnSync("node", [buildScript], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    assert.equal(readFileSync(distSentinel, "utf8"), "build:1\n");

    const oldDate = new Date("2000-01-01T00:00:00.000Z");
    writeFileSync(sourceFile, "export const marker = 'v2';\n");
    utimesSync(sourceFile, oldDate, oldDate);
    utimesSync(join(workspace, "package.json"), oldDate, oldDate);
    utimesSync(join(workspace, "tsconfig.json"), oldDate, oldDate);
    utimesSync(join(workspace, "tsconfig.build.json"), oldDate, oldDate);

    const second = spawnSync("node", [buildScript], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
    assert.equal(readFileSync(distSentinel, "utf8"), "build:2\n");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
