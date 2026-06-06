// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { buildComplianceSummary } from "../../../../../../packages/features/compliance/src/hooks";

describe("buildComplianceSummary", () => {
  it("labels exception approval rate honestly instead of presenting it as overall compliance passing", () => {
    const summary = buildComplianceSummary({
      policies: [
        { id: "sox", name: "Sarbanes-Oxley", severity: "critical" },
        { id: "gdpr", name: "GDPR", severity: "high" },
      ],
      exceptions: [
        { id: "exc-1", reason: "manual_exception_review_requested", policyId: "sox", status: "approved" },
        { id: "exc-2", reason: "manual_exception_review_requested", policyId: "sox", status: "rejected" },
        { id: "exc-3", reason: "manual_exception_review_requested", policyId: "gdpr", status: "pending" },
      ],
      auditLogs: [
        { id: "audit-1", action: "compliance.exception.approved", timestamp: "2026-06-06T00:00:00.000Z" },
      ],
    });

    expect(summary.metrics).toEqual([
      { label: "标准项", value: 2 },
      { label: "审计事件", value: 1 },
      { label: "例外批准率", value: "33%" },
    ]);
    expect(summary.rows[1]?.value).toBe("1 critical policies, 1 pending exceptions");
  });

  it("returns n/a when no exceptions exist instead of a fabricated 100 percent pass rate", () => {
    const summary = buildComplianceSummary({
      policies: [],
      exceptions: [],
      auditLogs: [],
    });

    expect(summary.metrics[2]).toEqual({ label: "例外批准率", value: "n/a" });
    expect(summary.items[1]?.description).toMatch(/No pending compliance exceptions/);
  });
});
