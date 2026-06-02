import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const AUDIT_TEST_PORTABILITY = join(process.cwd(), "scripts", "ci", "audit-test-portability.mjs");
const AUDIT_CI_SUPPLY_CHAIN = join(process.cwd(), "scripts", "ci", "audit-ci-supply-chain.mjs");

test("audit-test-portability flags generic absolute developer paths and degrades outside git", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-test-portability-"));
  try {
    mkdirSync(join(workspace, "tests"), { recursive: true });
    writeFileSync(
      join(workspace, "tests", "portable.test.ts"),
      "const path = '/Users/alice/project/file.ts';\n",
    );

    const result = spawnSync(process.execPath, [AUDIT_TEST_PORTABILITY], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: "",
      },
    });

    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /absolute-workspace-path: tests\/portable\.test\.ts/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("audit-ci-supply-chain distinguishes missing inputs and reads machine version marker", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-supply-chain-audit-"));
  try {
    const missing = spawnSync(process.execPath, [AUDIT_CI_SUPPLY_CHAIN], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(missing.status, 2, `${missing.stdout}\n${missing.stderr}`);
    assert.match(missing.stderr, /supply_chain\.read_failed/);

    mkdirSync(join(workspace, ".github", "workflows"), { recursive: true });
    mkdirSync(join(workspace, "deploy", "helm", "automatic-agent"), { recursive: true });
    mkdirSync(join(workspace, "deploy", "prometheus", "rules"), { recursive: true });
    mkdirSync(join(workspace, "deploy", "prometheus"), { recursive: true });
    mkdirSync(join(workspace, "docs_zh", "operations"), { recursive: true });
    mkdirSync(join(workspace, "docs_zh", "quality"), { recursive: true });
    mkdirSync(join(workspace, "docs_zh", "contracts"), { recursive: true });
    mkdirSync(join(workspace, "docs_zh", "adr"), { recursive: true });
    writeFileSync(join(workspace, ".github", "workflows", "ci.yml"), "permissions:\n  contents: read\n  actions: read\njobs:\n");
    writeFileSync(join(workspace, ".github", "workflows", "publish-image.yml"), "permissions:\n  contents: read\njobs:\n");
    writeFileSync(join(workspace, "Dockerfile"), "FROM node:22\nUSER node\nHEALTHCHECK CMD true\nRUN npm ci --ignore-scripts\nFROM deps AS runtime-deps\nRUN npm prune --omit=dev\nCOPY /app/node_modules ./node_modules\nARG TINI_VERSION=\"v0.19.0\"\nARG TINI_SHA256=value\nRUN echo https://github.com/krallin/tini/releases/download\n");
    writeFileSync(join(workspace, "deploy", "prometheus", "rules", "automatic-agent.yml"), "severity: critical\nDLQ\n");
    writeFileSync(join(workspace, "deploy", "prometheus", "alertmanager.yml"), "pagerduty-critical\nslack-warning\n");
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ version: "0.2.0", engines: { node: ">=22 <23" } }, null, 2));
    writeFileSync(join(workspace, "package-lock.json"), "{}\n");
    writeFileSync(join(workspace, "LICENSE"), "MIT License\n");
    writeFileSync(join(workspace, "deploy", "helm", "automatic-agent", "Chart.yaml"), "version: 0.2.0\nappVersion: 0.2.0\n");
    writeFileSync(join(workspace, "docs_zh", "operations", "release-versioning.md"), "ReleaseBaselineVersion: `9.9.9`\n");
    writeFileSync(join(workspace, "docs_zh", "quality", "supply-chain-security.md"), "# Supply chain\n");
    writeFileSync(join(workspace, "docs_zh", "quality", "actions-allowlist.md"), "treosh/lighthouse-ci-action\n512cc908a55bfb0ad231facca52adf3d3a651df4\n");
    writeFileSync(join(workspace, "docs_zh", "quality", "license-compliance.md"), "# License\n");
    writeFileSync(join(workspace, "docs_zh", "contracts", "README.md"), "# Contracts\n");
    for (let index = 0; index < 140; index += 1) {
      writeFileSync(join(workspace, "docs_zh", "contracts", `contract-${index}.md`), "# contract\n");
    }
    writeFileSync(join(workspace, "docs_zh", "adr", "109-contract-freeze.md"), "# ADR 109\n");

    const mismatch = spawnSync(process.execPath, [AUDIT_CI_SUPPLY_CHAIN], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(mismatch.status, 1, `${mismatch.stdout}\n${mismatch.stderr}`);
    assert.match(mismatch.stdout, /release-versioning\.md machine marker must equal package\.json version/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
