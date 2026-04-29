import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "generate-src-module-test-matrix.mjs");

test("generate-src-module-test-matrix creates markdown file", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-matrix-"));

  try {
    mkdirSync(join(workspace, "src", "platform"), { recursive: true });
    writeFileSync(join(workspace, "src", "platform", "index.ts"), "export const platform = {};\n");

    mkdirSync(join(workspace, "tests", "unit", "platform"), { recursive: true });
    writeFileSync(join(workspace, "tests", "unit", "platform", "index.test.ts"), "import assert from 'node:assert/strict';\nimport test from 'node:test';\ntest('placeholder', () => {});\n");

    mkdirSync(join(workspace, "docs_zh", "operations"), { recursive: true });

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    const outputPath = join(workspace, "docs_zh", "operations", "src_module_test_matrix.md");
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.equal(existsSync(outputPath), true);

    const content = readFileSync(outputPath, "utf8");
    assert.ok(content.includes("# Src 模块测试矩阵"));
    assert.ok(content.includes("| 模块 |"));
    assert.ok(content.includes("`platform`"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("generate-src-module-test-matrix handles empty source", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-matrix-"));

  try {
    mkdirSync(join(workspace, "docs_zh", "operations"), { recursive: true });
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, "tests"), { recursive: true });

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    const outputPath = join(workspace, "docs_zh", "operations", "src_module_test_matrix.md");
    assert.equal(result.status, 0);
    assert.equal(existsSync(outputPath), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});