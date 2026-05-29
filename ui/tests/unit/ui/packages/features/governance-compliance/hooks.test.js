import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
    mockClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
    mockFetchCompliancePolicies: vi.fn(async () => [
        { id: "policy-1", name: "Prod Change Control", severity: "high" },
    ]),
    mockUpdateCompliancePolicy: vi.fn(async () => ({ ok: true })),
    mockFetchAuditLogs: vi.fn(async () => [
        { id: "audit-1", timestamp: "2026-05-06T00:00:00.000Z", actor: "platform-sre", action: "policy.update", resource: "policy-1", outcome: "success", metadata: {} },
    ]),
    mockSubmitException: vi
        .fn()
        .mockResolvedValueOnce({ id: "exc-1" })
        .mockResolvedValueOnce({ id: "exc-2" }),
    mockApproveException: vi.fn(async () => ({ ok: true })),
    mockRejectException: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@aa/shared-state", () => ({
    useRestClient: () => mocks.mockClient,
}));
vi.mock("@aa/shared-api-client", () => ({
    fetchCompliancePolicies: mocks.mockFetchCompliancePolicies,
    updateCompliancePolicy: mocks.mockUpdateCompliancePolicy,
    fetchAuditLogs: mocks.mockFetchAuditLogs,
    submitException: mocks.mockSubmitException,
    approveException: mocks.mockApproveException,
    rejectException: mocks.mockRejectException,
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
        expect(mocks.mockApproveException).toHaveBeenCalledWith(mocks.mockClient, "exc-1");
        expect(mocks.mockRejectException).toHaveBeenCalledWith(mocks.mockClient, "exc-2", "not justified");
        expect(result.current.exceptionQueue[0]?.status).toBe("rejected");
    });
});
