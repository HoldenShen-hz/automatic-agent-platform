import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const ARCHITECTURE_BOUNDARY_SCAN = join(process.cwd(), "scripts", "architecture-boundary-scan.mjs");
const CURRENT_CODEBASE_GAP_SCAN = join(process.cwd(), "scripts", "scan-current-codebase-gap.mjs");

test("architecture-boundary-scan returns distinct detect-only exit code when findings exist", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-architecture-scan-"));
  const scriptPath = join(workspace, "scripts", "architecture-boundary-scan.mjs");
  const reportPath = join(
    workspace,
    "artifacts",
    "validation",
    "architecture",
    "architecture-boundary-scan-report.json",
  );

  try {
    mkdirSync(join(workspace, "scripts"), { recursive: true });
    mkdirSync(join(workspace, "src"), { recursive: true });
    copyFileSync(ARCHITECTURE_BOUNDARY_SCAN, scriptPath);
    writeFileSync(
      join(workspace, "src", "violating-import.ts"),
      'import { gate } from "./platform/shared/stability/stable-release-gate.ts";\n',
    );

    const result = spawnSync("node", [scriptPath, "detect-only"], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      status: string;
      findings: Array<{ ruleId: string }>;
    };
    assert.equal(report.status, "findings_detected");
    assert.ok(report.findings.some((finding) => finding.ruleId === "AB-003"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("scan-current-codebase-gap writes markdown artifacts outside docs_zh reviews", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-current-gap-scan-"));
  const scriptPath = join(workspace, "scripts", "scan-current-codebase-gap.mjs");
  const markdownArtifact = join(workspace, "artifacts", "current-codebase-gap-review-v1.9.md");
  const jsonArtifact = join(workspace, "artifacts", "current-codebase-gap-review-v1.9.json");
  const staleDocsOutput = join(workspace, "docs_zh", "reviews", "current-codebase-gap-review-v1.9.md");

  try {
    mkdirSync(join(workspace, "scripts"), { recursive: true });
    mkdirSync(join(workspace, ".github", "workflows"), { recursive: true });
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ scripts: {} }, null, 2));
    copyFileSync(CURRENT_CODEBASE_GAP_SCAN, scriptPath);

    const result = spawnSync("node", [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(existsSync(markdownArtifact), true);
    assert.equal(existsSync(jsonArtifact), true);
    assert.equal(existsSync(staleDocsOutput), false);
    assert.match(result.stdout, /artifacts\/current-codebase-gap-review-v1\.9\.md/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
