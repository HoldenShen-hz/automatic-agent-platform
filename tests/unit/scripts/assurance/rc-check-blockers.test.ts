import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  applyReleaseGateOverrides,
  buildRcCheckReport,
  countP0AlertsWithoutRunbooks,
  countUnsignedEvidenceBundleIssues,
  determineRcGateMode,
  isReleaseBlockingPath,
  loadReleaseGateOverrides,
} from "../../../../scripts/assurance/rc-check.mjs";

function writeWorkspaceFile(workspace: string, relativePath: string, contents: string) {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

test("rc-check defaults to observe mode unless explicitly enforced", () => {
  assert.equal(determineRcGateMode({}), "observe");
  assert.equal(determineRcGateMode({ AA_ASSURANCE_GATE_MODE: "enforce" }), "enforce");
  assert.equal(determineRcGateMode({ AA_ASSURANCE_GATE_MODE: "strict" }), "enforce");
});

test("rc-check release blocker path filter excludes tests and includes release surfaces", () => {
  assert.equal(isReleaseBlockingPath("src/platform/stability/stable-release-gate.ts"), true);
  assert.equal(isReleaseBlockingPath("docs_zh/reference/release.md"), true);
  assert.equal(isReleaseBlockingPath("tests/fixtures/seeded-defects/eval-oracle/positive.ts"), false);
  assert.equal(isReleaseBlockingPath("tests/audit-tools/release-claims-auditor.test.ts"), false);
});

test("rc-check report keeps observe-only blockers informational in observe mode", () => {
  const report = buildRcCheckReport(
    [{ id: "assurance:full", required: true, ok: true }],
    {
      gateMode: "observe",
      releaseBlockers: {
        gateMode: "observe",
        blockerCount: 1,
        blockers: [
          {
            blockerId: "tenant_isolation_p0",
            count: 4,
            observeOnly: true,
            evidenceRefs: ["artifacts/assurance/static-audit-report.json"],
          },
        ],
        observeOnlyBlockers: ["tenant_isolation_p0"],
        enforcedBlockers: [],
        status: "pass",
      },
    },
  );

  assert.equal(report.status, "pass");
  assert.deepEqual(report.failedReleaseBlockers, []);
});

test("rc-check report fails when enforced release blockers remain", () => {
  const report = buildRcCheckReport(
    [{ id: "assurance:full", required: true, ok: true }],
    {
      gateMode: "observe",
      releaseBlockers: {
        gateMode: "observe",
        blockerCount: 1,
        blockers: [
          {
            blockerId: "p0_issue_missing_test_binding",
            count: 2,
            observeOnly: false,
            evidenceRefs: ["artifacts/assurance/test-coverage-report.json"],
          },
        ],
        observeOnlyBlockers: [],
        enforcedBlockers: ["p0_issue_missing_test_binding"],
        status: "fail",
      },
    },
  );

  assert.equal(report.status, "fail");
  assert.deepEqual(report.failedReleaseBlockers, ["p0_issue_missing_test_binding"]);
});

test("rc-check observe mode can override enforced blockers with structured governance metadata", () => {
  const summary = applyReleaseGateOverrides(
    {
      gateMode: "observe",
      blockerCount: 1,
      blockers: [
        {
          blockerId: "p0_issue_missing_test_binding",
          count: 2,
          observeOnly: false,
          evidenceRefs: ["artifacts/assurance/test-coverage-report.json"],
        },
      ],
      observeOnlyBlockers: [],
      enforcedBlockers: ["p0_issue_missing_test_binding"],
      status: "fail",
    },
    {
      path: "/tmp/release-gate-overrides.json",
      overrides: [
        {
          overrideId: "AAS-RC-OVERRIDE-0001",
          blockerIds: ["p0_issue_missing_test_binding"],
          owner: "release-owner",
          expiry: "2099-01-01T00:00:00.000Z",
          reason: "temporary coverage ledger backfill in progress",
          riskAcceptance: "release owner accepts temporary observe-mode exposure",
          followUpIssue: "AAS-ISSUE-999999",
          approvedAt: "2098-12-31T00:00:00.000Z",
        },
      ],
      invalidOverrides: [],
    },
    "observe",
    new Date("2098-01-01T00:00:00.000Z"),
  );

  assert.equal(summary.status, "pass");
  assert.deepEqual(summary.overriddenBlockers, ["p0_issue_missing_test_binding"]);
  assert.deepEqual(summary.enforcedBlockers, []);
});

test("rc-check enforce mode ignores release overrides and invalid override shapes fail closed", () => {
  const summary = applyReleaseGateOverrides(
    {
      gateMode: "enforce",
      blockerCount: 1,
      blockers: [
        {
          blockerId: "p0_issue_missing_test_binding",
          count: 1,
          observeOnly: false,
          evidenceRefs: ["artifacts/assurance/test-coverage-report.json"],
        },
      ],
      observeOnlyBlockers: [],
      enforcedBlockers: ["p0_issue_missing_test_binding"],
      status: "fail",
    },
    {
      path: "/tmp/release-gate-overrides.json",
      overrides: [
        {
          overrideId: "AAS-RC-OVERRIDE-0001",
          blockerIds: ["p0_issue_missing_test_binding"],
          owner: "release-owner",
          expiry: "2099-01-01T00:00:00.000Z",
          reason: "temporary coverage ledger backfill in progress",
          riskAcceptance: "release owner accepts temporary observe-mode exposure",
          followUpIssue: "AAS-ISSUE-999999",
          approvedAt: "2098-12-31T00:00:00.000Z",
        },
      ],
      invalidOverrides: [{ overrideId: "AAS-RC-OVERRIDE-BAD" }],
    },
    "enforce",
    new Date("2098-01-01T00:00:00.000Z"),
  );

  assert.equal(summary.status, "fail");
  assert.deepEqual(summary.enforcedBlockers, ["p0_issue_missing_test_binding"]);
  assert.deepEqual(summary.invalidOverrideIds, ["AAS-RC-OVERRIDE-BAD"]);
});

test("rc-check report fails when override ledger itself is invalid", () => {
  const report = buildRcCheckReport(
    [{ id: "assurance:full", required: true, ok: true }],
    {
      gateMode: "observe",
      releaseBlockers: {
        gateMode: "observe",
        blockerCount: 0,
        blockers: [],
        observeOnlyBlockers: [],
        overriddenBlockers: [],
        overriddenBy: [],
        expiredOverrideIds: [],
        invalidOverrideIds: ["AAS-RC-OVERRIDE-BAD"],
        enforcedBlockers: [],
        status: "fail",
      },
    },
  );

  assert.equal(report.status, "fail");
  assert.deepEqual(report.failedReleaseOverrideIds, ["AAS-RC-OVERRIDE-BAD"]);
});

test("rc-check loads empty release gate overrides ledger by default", () => {
  const ledger = loadReleaseGateOverrides();
  assert.ok(ledger.path.endsWith("data/governance/release-gate-overrides.json"));
  assert.deepEqual(ledger.invalidOverrides, []);
  assert.deepEqual(ledger.overrides, []);
});

test("rc-check counts P0 alerts without runbook metadata or files as blocking", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-rc-runbook-"));
  try {
    writeWorkspaceFile(
      workspace,
      "config/validation/platform-validation-registry.json",
      JSON.stringify({
        sources: {
          runbookMetadata: "config/validation/platform-runbook-metadata.json",
        },
        gates: [
          { gateId: "GATE-P0-001", ciJob: "observability-smoke", runbookId: "D.25" },
          { gateId: "GATE-P1-001", ciJob: "quality", runbookId: "D.99" },
        ],
        runbooks: [
          { runbookId: "D.25", path: "deploy/runbooks/p0-runbook.md" },
          { runbookId: "D.99", path: "deploy/runbooks/p1-runbook.md" },
        ],
      }, null, 2),
    );
    writeWorkspaceFile(
      workspace,
      "config/validation/platform-runbook-metadata.json",
      JSON.stringify({
        runbooks: [
          { runbookId: "D.25", severity: "P0" },
          { runbookId: "D.99", severity: "P1" },
        ],
      }, null, 2),
    );
    writeWorkspaceFile(workspace, "deploy/runbooks/p1-runbook.md", "# P1 runbook\n");

    assert.equal(countP0AlertsWithoutRunbooks(workspace), 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("rc-check does not count unsigned bundle before prebundle phase but fails later", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-rc-bundle-"));
  try {
    assert.equal(countUnsignedEvidenceBundleIssues(workspace, [], "prebundle"), 0);
    assert.equal(countUnsignedEvidenceBundleIssues(workspace, [], "preseal"), 1);

    writeWorkspaceFile(workspace, "artifacts/release/evidence-bundle.json", "{}\n");
    writeWorkspaceFile(workspace, "artifacts/release/evidence-bundle.sig", "deadbeef  evidence-bundle.json\n");
    assert.equal(
      countUnsignedEvidenceBundleIssues(
        workspace,
        [{ id: "evidence:bundle:verify", ok: false }],
        "sealed",
      ),
      1,
    );
    assert.equal(
      countUnsignedEvidenceBundleIssues(
        workspace,
        [
          { id: "evidence:bundle:create", ok: true },
          { id: "evidence:bundle:verify", ok: true },
        ],
        "sealed",
      ),
      0,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
