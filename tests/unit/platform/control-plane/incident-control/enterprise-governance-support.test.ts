import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";

import {
  sha256,
  extractPackageName,
  detectSourceType,
  isPrereleaseVersion,
  summarizeVerdict,
  mapOpsStatusToHandoffStatus,
  selectSloActualValue,
  buildMarkdownReport,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/enterprise-governance-support.js";

test("sha256 computes correct hash", () => {
  const result = sha256("hello world");
  // sha256 of "hello world" in hex
  assert.equal(result, createHash("sha256").update("hello world", "utf8").digest("hex"));
});

test("sha256 handles empty string", () => {
  const result = sha256("");
  assert.equal(result, createHash("sha256").update("", "utf8").digest("hex"));
});

test("sha256 handles unicode", () => {
  const result = sha256("こんにちは");
  assert.equal(result, createHash("sha256").update("こんにちは", "utf8").digest("hex"));
});

test("extractPackageName extracts from node_modules path", () => {
  // Returns the last segment after splitting by node_modules/
  assert.equal(extractPackageName("/project/node_modules/lodash/package.json"), "lodash/package.json");
  assert.equal(extractPackageName("/a/node_modules/pkg/sub/path/file.js"), "pkg/sub/path/file.js");
});

test("extractPackageName returns input when no node_modules", () => {
  // No node_modules means single segment, returns original path
  assert.equal(extractPackageName("/project/src/index.js"), "/project/src/index.js");
  assert.equal(extractPackageName("/project/package.json"), "/project/package.json");
});

test("extractPackageName handles scoped packages", () => {
  assert.equal(extractPackageName("/project/node_modules/@types/node/package.json"), "@types/node/package.json");
});

test("detectSourceType returns workspace for null/undefined/empty", () => {
  assert.equal(detectSourceType(undefined), "workspace");
  assert.equal(detectSourceType(null as any), "workspace");
  assert.equal(detectSourceType(""), "workspace");
});

test("detectSourceType returns registry for https URLs", () => {
  assert.equal(detectSourceType("https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"), "registry");
  assert.equal(detectSourceType("https://example.com/package"), "registry");
});

test("detectSourceType returns file for file: URLs", () => {
  assert.equal(detectSourceType("file:./local/package"), "file");
  assert.equal(detectSourceType("file:/absolute/path"), "file");
});

test("detectSourceType returns other for other values", () => {
  assert.equal(detectSourceType("git+ssh://github.com/pkg"), "other");
  assert.equal(detectSourceType("github:user/repo"), "other");
  assert.equal(detectSourceType("npm:lodash@4.17.21"), "other");
});

test("isPrereleaseVersion detects alpha", () => {
  assert.equal(isPrereleaseVersion("1.0.0-alpha.1"), true);
  assert.equal(isPrereleaseVersion("2.1.0-alpha"), true);
});

test("isPrereleaseVersion detects beta", () => {
  assert.equal(isPrereleaseVersion("1.0.0-beta.1"), true);
  assert.equal(isPrereleaseVersion("3.0.0-beta"), true);
});

test("isPrereleaseVersion detects rc", () => {
  assert.equal(isPrereleaseVersion("1.0.0-rc.1"), true);
  assert.equal(isPrereleaseVersion("2.0.0-RC"), true);
});

test("isPrereleaseVersion detects canary", () => {
  assert.equal(isPrereleaseVersion("1.0.0-canary.1"), true);
  assert.equal(isPrereleaseVersion("2.0.0-canary"), true);
});

test("isPrereleaseVersion detects next/preview", () => {
  assert.equal(isPrereleaseVersion("1.0.0-next.1"), true);
  assert.equal(isPrereleaseVersion("2.0.0-preview.1"), true);
});

test("isPrereleaseVersion returns false for stable versions", () => {
  assert.equal(isPrereleaseVersion("1.0.0"), false);
  assert.equal(isPrereleaseVersion("2.1.3"), false);
  assert.equal(isPrereleaseVersion("0.1.0"), false);
});

test("isPrereleaseVersion is case insensitive", () => {
  assert.equal(isPrereleaseVersion("1.0.0-ALPHA.1"), true);
  assert.equal(isPrereleaseVersion("2.0.0-Beta.2"), true);
});

test("summarizeVerdict returns pass when no issues", () => {
  assert.equal(summarizeVerdict(false, false), "pass");
});

test("summarizeVerdict returns warning when only warnings", () => {
  assert.equal(summarizeVerdict(false, true), "warning");
});

test("summarizeVerdict returns fail when critical present", () => {
  assert.equal(summarizeVerdict(true, false), "fail");
  assert.equal(summarizeVerdict(true, true), "fail");
});

test("mapOpsStatusToHandoffStatus returns blocked for fail status", () => {
  assert.equal(mapOpsStatusToHandoffStatus("fail"), "blocked");
});

test("mapOpsStatusToHandoffStatus returns warning for warning status", () => {
  assert.equal(mapOpsStatusToHandoffStatus("warning"), "warning");
});

test("mapOpsStatusToHandoffStatus returns ready for pass status", () => {
  assert.equal(mapOpsStatusToHandoffStatus("pass"), "ready");
});

test("selectSloActualValue returns actual value for matching key", () => {
  const report = {
    slos: [
      { key: "task_success_rate", actualValue: 99.5 },
      { key: "task_start_latency", actualValue: 15000 },
    ],
  } as any;
  assert.equal(selectSloActualValue(report, "task_success_rate"), 99.5);
  assert.equal(selectSloActualValue(report, "task_start_latency"), 15000);
});

test("selectSloActualValue returns 0 for missing key", () => {
  const report = {
    slos: [
      { key: "task_success_rate", actualValue: 99.5 },
    ],
  } as any;
  assert.equal(selectSloActualValue(report, "missing_key"), 0);
});

test("buildMarkdownReport formats report correctly", () => {
  const mockReport = {
    reportId: "test-report-id",
    environment: "prod",
    shiftOwner: "test-owner",
    status: "pass",
    incidentHandoff: {
      activeIncidentId: "INC-001",
      primaryOncall: "oncall-primary",
      secondaryOncall: "oncall-secondary",
      checklist: ["Check system health", "Verify backups"],
    },
    schemaGate: {
      portability: { issueCount: 0 },
      schemaCompatibility: { issueCount: 0 },
    },
    supplyChain: {
      packageCount: 50,
      summary: {
        criticalFindingCount: 0,
        warningFindingCount: 1,
      },
    },
    apmExport: {
      datadog: { series: [{ metric: "test" }] },
      grafana: { dashboard: { panels: [{ metric: "test" }] } },
      otel: { metricSamples: [{ metric: "test" }] },
    },
  } as any;

  const markdown = buildMarkdownReport(mockReport);

  assert.ok(markdown.includes("Enterprise Governance Report"));
  assert.ok(markdown.includes("test-report-id"));
  assert.ok(markdown.includes("prod"));
  assert.ok(markdown.includes("test-owner"));
  assert.ok(markdown.includes("pass"));
  assert.ok(markdown.includes("INC-001"));
  assert.ok(markdown.includes("oncall-primary"));
  assert.ok(markdown.includes("oncall-secondary"));
});

test("buildMarkdownReport handles null incident", () => {
  const mockReport = {
    reportId: "test-report-id",
    environment: "dev",
    shiftOwner: "dev-owner",
    status: "warning",
    incidentHandoff: {
      activeIncidentId: null,
      primaryOncall: "oncall-primary",
      secondaryOncall: "oncall-secondary",
      checklist: [],
    },
    schemaGate: {
      portability: { issueCount: 1 },
      schemaCompatibility: { issueCount: 0 },
    },
    supplyChain: {
      packageCount: 10,
      summary: {
        criticalFindingCount: 0,
        warningFindingCount: 0,
      },
    },
    apmExport: {
      datadog: { series: [] },
      grafana: { dashboard: { panels: [] } },
      otel: { metricSamples: [] },
    },
  } as any;

  const markdown = buildMarkdownReport(mockReport);

  assert.ok(markdown.includes("Enterprise Governance Report"));
  assert.ok(markdown.includes("none")); // For null incident
  assert.ok(markdown.includes("warning"));
});
