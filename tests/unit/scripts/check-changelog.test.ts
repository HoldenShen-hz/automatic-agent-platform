import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const SCRIPT_PATH = join(process.cwd(), "scripts", "ci", "check-changelog.mjs");

test("check-changelog validates CHANGELOG.md exists and has heading", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-changelog-"));

  try {
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ version: "1.0.0" }));
    writeFileSync(join(workspace, "CHANGELOG.md"), "# Changelog\n\n## [1.0.0]\n\nInitial");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.equal(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("check-changelog rejects missing CHANGELOG.md", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-changelog-"));

  try {
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ version: "1.0.0" }));

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("check-changelog rejects missing version in package.json", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-changelog-"));

  try {
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({}));
    writeFileSync(join(workspace, "CHANGELOG.md"), "# Changelog\n\n## [1.0.0]\n\nInitial");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("check-changelog rejects CHANGELOG missing version entry", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-changelog-"));

  try {
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ version: "2.0.0" }));
    writeFileSync(join(workspace, "CHANGELOG.md"), "# Changelog\n\n## [1.0.0]\n\nInitial");

    const result = spawnSync("node", [SCRIPT_PATH], {
      cwd: workspace,
      env: { ...process.env },
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});