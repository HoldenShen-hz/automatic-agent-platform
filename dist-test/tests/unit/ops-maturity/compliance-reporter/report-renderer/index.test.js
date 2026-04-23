import assert from "node:assert/strict";
import test from "node:test";
import { renderComplianceReportMarkdown, renderComplianceReportCsv, ComplianceReportRendererService, } from "../../../../../src/ops-maturity/compliance-reporter/report-renderer/index.js";
test("renderComplianceReportMarkdown renders title and sections", () => {
    const sections = [
        { title: "Overview", lines: ["Line 1", "Line 2"] },
        { title: "Details", lines: ["Line 3"] },
    ];
    const result = renderComplianceReportMarkdown("My Report", sections);
    assert.ok(result.startsWith("# My Report"));
    assert.ok(result.includes("## Overview"));
    assert.ok(result.includes("Line 1"));
});
test("renderComplianceReportMarkdown handles empty sections", () => {
    const result = renderComplianceReportMarkdown("Empty", []);
    assert.ok(result.startsWith("# Empty"));
});
test("renderComplianceReportCsv renders section and lines", () => {
    const sections = [
        { title: "Section A", lines: ["row1", "row2"] },
        { title: "Section B", lines: ["row3"] },
    ];
    const result = renderComplianceReportCsv(sections);
    assert.ok(result.startsWith("section,line"));
    assert.ok(result.includes("Section A,row1"));
    assert.ok(result.includes("Section B,row3"));
});
test("ComplianceReportRendererService.renderMarkdown delegates to helper", () => {
    const service = new ComplianceReportRendererService();
    const sections = [{ title: "Test", lines: ["line1"] }];
    const result = service.renderMarkdown("Title", sections);
    assert.ok(result.startsWith("# Title"));
});
test("ComplianceReportRendererService.renderCsv delegates to helper", () => {
    const service = new ComplianceReportRendererService();
    const sections = [{ title: "Test", lines: ["line1"] }];
    const result = service.renderCsv(sections);
    assert.ok(result.startsWith("section,line"));
});
test("ComplianceReportRendererService.renderJson renders JSON", () => {
    const service = new ComplianceReportRendererService();
    const sections = [{ title: "Test", lines: ["line1"] }];
    const result = service.renderJson("Title", sections);
    const parsed = JSON.parse(result);
    assert.equal(parsed.title, "Title");
    assert.equal(parsed.sections.length, 1);
});
//# sourceMappingURL=index.test.js.map