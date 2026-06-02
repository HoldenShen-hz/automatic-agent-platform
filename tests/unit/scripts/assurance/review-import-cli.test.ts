import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const scriptPath = "/Users/holden/Project/automatic_agent/automatic_agent_platform/scripts/assurance/review-import.mjs";

test("review-import defaults to the implementation repo root when --repo-root is omitted", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-cli-"));
  writeFile(
    join(repoRoot, "docs_zh", "reviews", "note.md"),
    "# freeform review\n\nno structured rows\n",
  );

  const result = spawnSync(process.execPath, [scriptPath, "--check", "--reviews-root", "docs_zh/reviews", "--output-dir", "artifacts/assurance"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.pass, true);
});

test("review-import check mode fails when explicit repo root contains parse warnings", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-cli-check-"));
  writeFile(
    join(repoRoot, "docs_zh", "reviews", "note.md"),
    "# freeform review\n\nno structured rows\n",
  );

  const result = spawnSync(process.execPath, [scriptPath, "--repo-root", repoRoot, "--check", "--reviews-root", "docs_zh/reviews", "--output-dir", "artifacts/assurance"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.pass, false);
  assert.match(payload.reasons.join(","), /parse_warnings/);
});

test("review-import check mode can pass when explicit repo root contains allowed parse warnings", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-cli-pass-"));
  writeFile(
    join(repoRoot, "docs_zh", "reviews", "review.md"),
    "# freeform review\n\nno structured rows\n",
  );

  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      "--repo-root",
      repoRoot,
      "--check",
      "--allow-parse-warnings",
      "--allow-conflicts",
      "--reviews-root",
      "docs_zh/reviews",
      "--output-dir",
      "artifacts/assurance",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.pass, true);
});
