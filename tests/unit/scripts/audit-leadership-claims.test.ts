import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

type LeadershipAuditModule = {
  buildLeadershipClaimScanReport: (options: {
    rootDir: string;
    configRoot: string;
    dataRoot: string;
    scanRoots: string[];
    now: Date;
  }) => {
    generatedAt: string;
    hits: Array<{ filePath: string; matchedText: string; status: string }>;
    summary: { blockedCount: number; allowlistedCount: number; approvedClaimCount: number };
  };
  inferClaimSurface: (filePath: string) => string;
};

const auditModule = await import(
  new URL("../../../scripts/ci/audit-leadership-claims.mjs", import.meta.url).href
) as LeadershipAuditModule;

const { buildLeadershipClaimScanReport, inferClaimSurface } = auditModule;

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

test("inferClaimSurface classifies UI and release-note paths", () => {
  assert.equal(inferClaimSurface("ui/apps/web/src/page.tsx"), "ui");
  assert.equal(inferClaimSurface("docs_zh/reference/platform_release_notes.md"), "release_note");
  assert.equal(inferClaimSurface("docs_zh/reference/platform.md"), "docs");
});

test("buildLeadershipClaimScanReport respects allowlist and approved claims and writes a report", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-leadership-audit-"));
  const configRoot = join(workspace, "config", "division-coverage");
  const dataRoot = join(workspace, "data");
  const now = new Date("2026-05-31T00:00:00.000Z");

  try {
    writeFile(join(configRoot, "schemas", "leadership-claim.schema.json"), JSON.stringify({ $id: "aa://leadership-claim.schema.json" }));
    writeFile(join(configRoot, "claims", "allowlist.yaml"), [
      "entries:",
      "  - filePath: docs_zh/reference/claim-gate.md",
      "    matchedText: industry-leading",
      "    reason: governance_rule_definition",
      "    owner: governance-owner",
      "    expiresAt: \"2027-01-01T00:00:00Z\"",
    ].join("\n"));
    writeFile(join(configRoot, "claims", "records.yaml"), [
      "claims:",
      "  - claimId: coding-ui-approved",
      "    claimText: \"industry-leading support for coding pilot\"",
      "    allowedSurfaces: [ui]",
      "    status: approved",
      "    expiresAt: \"2027-01-01T00:00:00Z\"",
    ].join("\n"));
    writeFile(join(workspace, "docs_zh", "reference", "claim-gate.md"), "This governance doc defines industry-leading as a gated term.");
    writeFile(join(workspace, "ui", "apps", "web", "src", "claim-banner.tsx"), "export const banner = 'industry-leading support for coding pilot';");

    const report = buildLeadershipClaimScanReport({
      rootDir: workspace,
      configRoot,
      dataRoot,
      scanRoots: ["docs_zh", "ui"],
      now,
    });

    assert.equal(report.summary.blockedCount, 0);
    assert.equal(report.summary.allowlistedCount, 1);
    assert.equal(report.summary.approvedClaimCount, 1);
    assert.equal(report.hits.find((hit) => hit.filePath === "docs_zh/reference/claim-gate.md")?.status, "allowlisted");
    assert.equal(report.hits.find((hit) => hit.filePath === "ui/apps/web/src/claim-banner.tsx")?.status, "approved_claim");

    const persisted = JSON.parse(readFileSync(join(dataRoot, "governance", "leadership-claim-scan-report.json"), "utf8")) as {
      summary: { blockedCount: number };
    };
    assert.equal(persisted.summary.blockedCount, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildLeadershipClaimScanReport fails expired allowlist entries instead of grandfathering them", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-leadership-audit-expired-"));
  const configRoot = join(workspace, "config", "division-coverage");
  const dataRoot = join(workspace, "data");
  const now = new Date("2026-05-31T00:00:00.000Z");

  try {
    writeFile(join(configRoot, "schemas", "leadership-claim.schema.json"), JSON.stringify({ $id: "aa://leadership-claim.schema.json" }));
    writeFile(join(configRoot, "claims", "records.yaml"), "claims: []");
    writeFile(join(configRoot, "claims", "allowlist.yaml"), [
      "entries:",
      "  - filePath: docs_zh/reference/expired.md",
      "    matchedText: production-ready",
      "    reason: stale_exception",
      "    owner: governance-owner",
      "    expiresAt: \"2026-05-01T00:00:00Z\"",
    ].join("\n"));
    writeFile(join(workspace, "docs_zh", "reference", "expired.md"), "This page still says production-ready.");

    const report = buildLeadershipClaimScanReport({
      rootDir: workspace,
      configRoot,
      dataRoot,
      scanRoots: ["docs_zh"],
      now,
    });

    assert.equal(report.summary.blockedCount, 1);
    assert.equal(report.hits[0]?.status, "expired_allowlist");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildLeadershipClaimScanReport does not grandfather config-approved claims after runtime revocation", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-leadership-audit-revoked-"));
  const configRoot = join(workspace, "config", "division-coverage");
  const dataRoot = join(workspace, "data");
  const now = new Date("2026-05-31T00:00:00.000Z");

  try {
    writeFile(join(configRoot, "schemas", "leadership-claim.schema.json"), JSON.stringify({ $id: "aa://leadership-claim.schema.json" }));
    writeFile(join(configRoot, "claims", "allowlist.yaml"), "entries: []");
    writeFile(join(configRoot, "claims", "records.yaml"), [
      "claims:",
      "  - claimId: coding-ui-approved",
      "    claimText: \"industry-leading support for coding pilot\"",
      "    allowedSurfaces: [ui]",
      "    status: approved",
      "    expiresAt: \"2027-01-01T00:00:00Z\"",
    ].join("\n"));
    writeFile(join(dataRoot, "governance", "leadership-claim-status-overrides.json"), JSON.stringify([
      {
        claimId: "coding-ui-approved",
        status: "revoked",
        reasonCode: "operator.revoked",
        revokedBy: "governance-operator",
        revokedAt: "2026-05-30T00:00:00.000Z",
        replacementRequired: true,
      },
    ], null, 2));
    writeFile(join(workspace, "ui", "apps", "web", "src", "claim-banner.tsx"), "export const banner = 'industry-leading support for coding pilot';");

    const report = buildLeadershipClaimScanReport({
      rootDir: workspace,
      configRoot,
      dataRoot,
      scanRoots: ["ui"],
      now,
    });

    assert.equal(report.summary.blockedCount, 1);
    assert.equal(report.hits[0]?.status, "blocked");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
