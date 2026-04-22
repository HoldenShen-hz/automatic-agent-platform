import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceProgramTemplateService } from "../../../../src/platform/compliance/compliance-program-template-service.js";

test("ComplianceProgramTemplateService lists templates and coverage matrix", () => {
  const service = new ComplianceProgramTemplateService();
  const templates = service.listTemplates();
  const gdpr = service.getTemplate("gdpr-export-erasure");
  const coverage = service.buildCoverageMatrix();

  assert.equal(templates.length, 3);
  assert.equal(gdpr?.regulation, "GDPR");
  assert.deepEqual(
    coverage.map((item: { templateId: string }) => item.templateId),
    ["gdpr-export-erasure", "soc2-audit-evidence", "hipaa-cross-region-transfer"],
  );
  assert.equal(coverage[0]?.controlCount, 3);
});
