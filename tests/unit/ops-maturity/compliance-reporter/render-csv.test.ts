/**
 * Unit tests for Compliance Report Renderer exports
 *
 * @see src/ops-maturity/compliance-reporter/report-renderer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as reportRenderer from "../../../../src/ops-maturity/compliance-reporter/report-renderer/index.js";

test("report-renderer exports renderComplianceReportCsv function", () => {
  assert.equal(typeof reportRenderer.renderComplianceReportCsv, "function");
});

test("renderComplianceReportCsv returns CSV header", () => {
  const result = reportRenderer.renderComplianceReportCsv([]);
  assert.ok(result.startsWith("section,line"));
});

test("renderComplianceReportCsv renders section title and lines", () => {
  const sections = [
    { title: "Template", lines: ["template_id=soc2", "framework=SOC2"] },
  ];

  const result = reportRenderer.renderComplianceReportCsv(sections);

  assert.ok(result.includes("Template,template_id=soc2"));
  assert.ok(result.includes("Template,framework=SOC2"));
});

test("renderComplianceReportCsv handles multiple sections", () => {
  const sections = [
    { title: "Section A", lines: ["a=1"] },
    { title: "Section B", lines: ["b=2", "b=3"] },
  ];

  const result = reportRenderer.renderComplianceReportCsv(sections);

  assert.ok(result.includes("Section A,a=1"));
  assert.ok(result.includes("Section B,b=2"));
  assert.ok(result.includes("Section B,b=3"));
});

test("renderComplianceReportCsv handles empty sections array", () => {
  const result = reportRenderer.renderComplianceReportCsv([]);
  assert.equal(result, "section,line");
});

test("renderComplianceReportCsv handles section with empty lines", () => {
  const sections = [{ title: "Empty", lines: [] }];
  const result = reportRenderer.renderComplianceReportCsv(sections);
  assert.ok(result.startsWith("section,line"));
  // No "Empty," appears in data rows since there are no lines
  const dataLines = result.split("\n").slice(1);
  assert.equal(dataLines.length, 0);
});