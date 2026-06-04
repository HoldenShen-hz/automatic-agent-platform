import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const scriptPath = resolve(repoRoot, "scripts/assurance/rc-check.mjs");

function nodeEval(source: string): string {
  return `node -e ${JSON.stringify(source.replace(/\s+/g, " ").trim())}`;
}

function writeWorkspaceFile(workspace: string, relativePath: string, contents: string): void {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

test("rc-check persists rc-check-report.json before evidence bundle creation", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-rc-check-order-"));
  try {
    const noop = nodeEval("process.exit(0);");
    const createBundle = nodeEval(`
      const fs = require("fs");
      const path = require("path");
      const releaseDir = path.join(process.cwd(), "artifacts", "release");
      const reportPath = path.join(releaseDir, "rc-check-report.json");
      if (!fs.existsSync(reportPath)) {
        console.error("rc-check-report.json missing before bundle create");
        process.exit(1);
      }
      fs.mkdirSync(releaseDir, { recursive: true });
      const observed = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      const observedPath = path.join(releaseDir, "observed-prebundle-report.json");
      if (!fs.existsSync(observedPath)) {
        fs.writeFileSync(observedPath, JSON.stringify(observed, null, 2));
      }
      fs.writeFileSync(path.join(releaseDir, "evidence-bundle.json"), "{\\n}\\n");
      fs.writeFileSync(path.join(releaseDir, "evidence-bundle.sig"), "sig  evidence-bundle.json\\n");
    `);
    const verifyBundle = nodeEval(`
      const fs = require("fs");
      const path = require("path");
      const releaseDir = path.join(process.cwd(), "artifacts", "release");
      for (const name of ["rc-check-report.json", "evidence-bundle.json", "evidence-bundle.sig"]) {
        if (!fs.existsSync(path.join(releaseDir, name))) {
          console.error(name + " missing during bundle verify");
          process.exit(1);
        }
      }
    `);

    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify(
        {
          name: "aa-rc-check-order-fixture",
          private: true,
          version: "1.0.0",
          scripts: {
            "assurance:full": noop,
            "test:p0": noop,
            "test:chaos:p0": noop,
            "test:redteam:p0": noop,
            "test:golden:strict": noop,
            "test:audit-tools": noop,
            "test:seeded-defects": noop,
            "evidence:bundle:create": createBundle,
            "evidence:bundle:verify": verifyBundle,
          },
        },
        null,
        2,
      ),
    );
    writeWorkspaceFile(
      workspace,
      "config/validation/platform-validation-registry.json",
      JSON.stringify({
        sources: {
          runbookMetadata: "config/validation/platform-runbook-metadata.json",
        },
        gates: [
          { gateId: "GATE-OBS-001", ciJob: "observability-smoke", runbookId: "D.25" },
        ],
        runbooks: [
          { runbookId: "D.25", path: "deploy/runbooks/p0-alert-runbook.md" },
        ],
      }, null, 2),
    );
    writeWorkspaceFile(
      workspace,
      "config/validation/platform-runbook-metadata.json",
      JSON.stringify({
        runbooks: [
          { runbookId: "D.25", severity: "P0" },
        ],
      }, null, 2),
    );
    writeWorkspaceFile(workspace, "deploy/runbooks/p0-alert-runbook.md", "# P0 alert runbook\n");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const observedPath = join(workspace, "artifacts", "release", "observed-prebundle-report.json");
    assert.equal(existsSync(observedPath), true);
    const observed = JSON.parse(readFileSync(observedPath, "utf8")) as {
      reportPhase?: string;
      executedSteps?: Array<{ id: string; pending?: boolean; ok?: boolean | null }>;
    };
    assert.equal(observed.reportPhase, "prebundle");
    assert.equal(
      observed.executedSteps?.some((step) => step.id === "evidence:bundle:create" && step.pending === true),
      true,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
