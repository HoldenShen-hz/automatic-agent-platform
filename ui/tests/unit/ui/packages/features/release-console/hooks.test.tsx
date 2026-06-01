import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockClient: { get: vi.fn(), post: vi.fn() },
  mockFetchLeadershipClaimsConsole: vi.fn(async () => ({
    generatedAt: "2026-05-31T00:00:00.000Z",
    families: [],
    claims: [],
    allowlist: [],
    scannerHits: [],
    scannerGeneratedAt: "2026-05-31T00:00:00.000Z",
    reviewRequests: [],
    noGoActions: [],
    summary: {
      familyCount: 6,
      approvedClaimCount: 2,
      expiringClaimCount: 1,
      pendingReviewRequestCount: 3,
      blockedScannerHitCount: 0,
      expiredAllowlistCount: 0,
      revokedClaimCount: 1,
      expiredClaimCount: 1,
    },
  })),
  mockApproveLeadershipClaimReviewRequest: vi.fn(async () => ({ reviewRequest: { requestId: "req-1", status: "approved", reviewedBy: "mock-admin" } })),
  mockRejectLeadershipClaimReviewRequest: vi.fn(async () => ({ reviewRequest: { requestId: "req-1", status: "rejected", reviewedBy: "mock-admin" } })),
  mockRevokeLeadershipClaim: vi.fn(async () => ({
    statusOverride: {
      claimId: "claim-1",
      status: "revoked",
      reasonCode: "operator.revoked",
      revokedBy: "mock-admin",
      revokedAt: "2026-05-31T00:00:00.000Z",
      replacementRequired: true,
    },
  })),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchLeadershipClaimsConsole: mocks.mockFetchLeadershipClaimsConsole,
  approveLeadershipClaimReviewRequest: mocks.mockApproveLeadershipClaimReviewRequest,
  rejectLeadershipClaimReviewRequest: mocks.mockRejectLeadershipClaimReviewRequest,
  revokeLeadershipClaim: mocks.mockRevokeLeadershipClaim,
}));

import { useReleaseConsoleVm } from "../../../../../../packages/features/release-console/src/hooks";

describe("useReleaseConsoleVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads leadership claims snapshot and exposes summary rows", async () => {
    const { result } = renderHook(() => useReleaseConsoleVm());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mocks.mockFetchLeadershipClaimsConsole).toHaveBeenCalledWith(mocks.mockClient);
    expect(result.current.summaryRows.some((row) => row.value === "6")).toBe(true);
    expect(result.current.summaryRows.some((row) => row.value === "2")).toBe(true);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.mutating).toBe(false);
  });
});
