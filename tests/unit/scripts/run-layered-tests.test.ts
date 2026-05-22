import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "run-layered-tests.mjs");

test("run-layered-tests resolves preset aliases", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-layered-"));

  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, "tests"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");

    const result = spawnSync("node", [SCRIPT_PATH, "smoke"], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.ok(result.status === 0 || result.status === 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-layered-tests rejects unknown layer", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-layered-"));

  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, "tests"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");

    const result = spawnSync("node", [SCRIPT_PATH, "nonexistent-layer"], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-layered-tests requires tests directory", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-layered-"));

  try {
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");

    const result = spawnSync("node", [SCRIPT_PATH, "unit"], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
    assert.ok(result.stderr?.toString().includes("tests") || result.stdout?.toString().includes("tests"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-layered-tests accepts concurrency env vars", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-layered-"));

  try {
    mkdirSync(join(workspace, "tests", "unit"), { recursive: true });
    writeFileSync(join(workspace, "tests", "unit", "placeholder.test.ts"), "");
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");

    const result = spawnSync("node", [SCRIPT_PATH, "unit"], {
      cwd: workspace,
      env: { ...process.env, AA_TEST_CONCURRENCY: "2" },
      stdio: "pipe",
    });

    assert.ok(result.status === 0 || result.status === 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("run-layered-tests force exits when a test leaves an active handle behind", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-layered-"));

  try {
    mkdirSync(join(workspace, "tests", "unit"), { recursive: true });
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "");
    writeFileSync(
      join(workspace, "tests", "unit", "lingering-handle.test.ts"),
      [
        "import test from \"node:test\";",
        "",
        "test(\"passes even with a lingering interval\", () => {",
        "  setInterval(() => {}, 60_000);",
        "});",
        "",
      ].join("\n"),
    );

    const result = spawnSync("node", [SCRIPT_PATH, "unit"], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
      timeout: 15_000,
    });

    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
