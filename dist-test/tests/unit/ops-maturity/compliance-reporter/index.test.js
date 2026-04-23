import assert from "node:assert/strict";
import test from "node:test";
import * as complianceReporter from "../../../../src/ops-maturity/compliance-reporter/index.js";
test("compliance-reporter index exports ComplianceReportPipelineService", () => {
    assert.ok(complianceReporter);
    assert.equal(typeof complianceReporter.ComplianceReportPipelineService, "function");
});
test("compliance-reporter index exports new registry and renderer services", () => {
    assert.equal(typeof complianceReporter.ComplianceTemplateRegistryService, "function");
    assert.equal(typeof complianceReporter.ComplianceReportRendererService, "function");
    assert.equal(typeof complianceReporter.EvidenceMapperService, "function");
});
//# sourceMappingURL=index.test.js.map