/**
 * Unit tests for renderComplianceReportCsv
 *
 * @see src/ops-maturity/compliance-reporter/report-renderer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  renderComplianceReportCsv,
} from "../../../../../src/ops-maturity/compliance-reporter/report-renderer/index.js";

test("renderComplianceReportCsv returns CSV header", () => {
  const result = renderComplianceReportCsv([]);
  assert.ok(result.startsWith("section,line"));
});

test("renderComplianceReportCsv renders section title and lines", () => {
  const sections = [
    { title: "Template", lines: ["template_id=soc2", "framework=SOC2"] },
  ];

  const result = renderComplianceReportCsv(sections);

  assert.ok(result.includes("Template,template_id=soc2"));
  assert.ok(result.includes("Template,framework=SOC2"));
});

test("renderComplianceReportCsv handles multiple sections", () => {
  const sections = [
    { title: "Section A", lines: ["a=1"] },
    { title: "Section B", lines: ["b=2", "b=3"] },
  ];

  const result = renderComplianceReportCsv(sections);

  assert.ok(result.includes("Section A,a=1"));
  assert.ok(result.includes("Section B,b=2"));
  assert.ok(result.includes("Section B,b=3"));
});

test("renderComplianceReportCsv handles empty sections array", () => {
  const result = renderComplianceReportCsv([]);
  assert.equal(result, "section,line");
});

test("renderComplianceReportCsv handles section with empty lines", () => {
  const sections = [{ title: "Empty", lines: [] }];
  const result = renderComplianceReportCsv(sections);
  assert.ok(result.includes("Empty,"));
});