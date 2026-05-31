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
    },
  })),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.mockClient,
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchLeadershipClaimsConsole: mocks.mockFetchLeadershipClaimsConsole,
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
  });
});
