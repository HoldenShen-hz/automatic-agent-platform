import assert from "node:assert/strict";
import test from "node:test";
import { UNIFIED_SEVERITIES, UNIFIED_SEVERITY_SLA, alertSeverityToUnifiedSeverity, anomalySeverityToUnifiedSeverity, diagnosticSeverityToUnifiedSeverity, runbookSeverityToUnifiedSeverity, } from "../../../../../src/platform/contracts/types/unified-severity.js";
test("UnifiedSeverity contract exposes four canonical severities", () => {
    assert.deepEqual(UNIFIED_SEVERITIES, ["SEV1", "SEV2", "SEV3", "SEV4"]);
});
test("UnifiedSeverity SLA table covers every canonical severity", () => {
    for (const severity of UNIFIED_SEVERITIES) {
        assert.ok(UNIFIED_SEVERITY_SLA[severity].acknowledgeWithinMinutes > 0);
        assert.ok(UNIFIED_SEVERITY_SLA[severity].mitigateWithinMinutes > 0);
    }
});
test("observability severities map to unified severity", () => {
    assert.equal(anomalySeverityToUnifiedSeverity("emergency"), "SEV1");
    assert.equal(anomalySeverityToUnifiedSeverity("critical"), "SEV2");
    assert.equal(anomalySeverityToUnifiedSeverity("warning"), "SEV3");
    assert.equal(anomalySeverityToUnifiedSeverity("info"), "SEV4");
});
test("alert and runbook severities map to unified severity", () => {
    assert.equal(alertSeverityToUnifiedSeverity("page"), "SEV1");
    assert.equal(alertSeverityToUnifiedSeverity("critical"), "SEV2");
    assert.equal(runbookSeverityToUnifiedSeverity("P1"), "SEV2");
    assert.equal(runbookSeverityToUnifiedSeverity("P3"), "SEV4");
});
test("diagnostic severities map to unified severity", () => {
    assert.equal(diagnosticSeverityToUnifiedSeverity("critical"), "SEV2");
    assert.equal(diagnosticSeverityToUnifiedSeverity("warning"), "SEV3");
    assert.equal(diagnosticSeverityToUnifiedSeverity("info"), "SEV4");
});
//# sourceMappingURL=unified-severity.test.js.map