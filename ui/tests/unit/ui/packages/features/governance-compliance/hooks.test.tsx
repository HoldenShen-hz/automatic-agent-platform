import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = { get: vi.fn(), patch: vi.fn(), post: vi.fn() };
const mockFetchCompliancePolicies = vi.fn(async () => [
  { id: "policy-1", name: "Prod Change Control", severity: "high" },
]);
const mockUpdateCompliancePolicy = vi.fn(async () => ({ ok: true }));
const mockFetchAuditLogs = vi.fn(async () => [
  { id: "audit-1", timestamp: "2026-05-06T00:00:00.000Z", actor: "platform-sre", action: "policy.update", resource: "policy-1", outcome: "success", metadata: {} },
]);
const mockSubmitException = vi
  .fn()
  .mockResolvedValueOnce({ id: "exc-1" })
  .mockResolvedValueOnce({ id: "exc-2" });
const mockApproveException = vi.fn(async () => ({ ok: true }));
const mockRejectException = vi.fn(async () => ({ ok: true }));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockClient,
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchCompliancePolicies: (...args: unknown[]) => mockFetchCompliancePolicies(...args),
  updateCompliancePolicy: (...args: unknown[]) => mockUpdateCompliancePolicy(...args),
  fetchAuditLogs: (...args: unknown[]) => mockFetchAuditLogs(...args),
  submitException: (...args: unknown[]) => mockSubmitException(...args),
  approveException: (...args: unknown[]) => mockApproveException(...args),
  rejectException: (...args: unknown[]) => mockRejectException(...args),
}));

import { useGovernanceComplianceVm } from "../../../../../../packages/features/governance-compliance/src/hooks";

describe("useGovernanceComplianceVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads policies and audit trail, then routes exception approvals through the API client", async () => {
    const { result } = renderHook(() => useGovernanceComplianceVm());

    await waitFor(() => {
      expect(result.current.policies).toHaveLength(1);
      expect(result.current.auditTrail).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitExceptionRequest("temporary bypass", "policy-1");
      await result.current.approveException("exc-1");
      await result.current.submitExceptionRequest("second bypass", "policy-1");
      await result.current.rejectException("exc-2", "not justified");
    });

    expect(mockApproveException).toHaveBeenCalledWith(mockClient, "exc-1");
    expect(mockRejectException).toHaveBeenCalledWith(mockClient, "exc-2", "not justified");
    expect(result.current.exceptionQueue[0]?.status).toBe("rejected");
  });
});
