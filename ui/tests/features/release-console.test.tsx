import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import releaseConsole from "../../packages/features/release-console/src/index";

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => ({ get: vi.fn(), post: vi.fn() }),
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchLeadershipClaimsConsole: vi.fn(async () => ({
    generatedAt: "2026-05-31T00:00:00.000Z",
    families: [],
    claims: [],
    allowlist: [],
    scannerHits: [],
    scannerGeneratedAt: "2026-05-31T00:00:00.000Z",
    reviewRequests: [],
    noGoActions: [],
    summary: {
      familyCount: 0,
      approvedClaimCount: 0,
      expiringClaimCount: 0,
      pendingReviewRequestCount: 0,
      blockedScannerHitCount: 0,
      expiredAllowlistCount: 0,
    },
  })),
}));

describe("release console feature", () => {
  it("renders the release console contract", () => {
    render(<releaseConsole.Component />);

    expect(screen.getByText("发布控制台")).toBeInTheDocument();
    expect(screen.getByText("运行门禁")).toBeInTheDocument();
    expect(screen.getByText("推进灰度")).toBeInTheDocument();
    expect(screen.getByText("查看回滚计划")).toBeInTheDocument();
    expect(screen.getByText("查看声明治理")).toBeInTheDocument();
    expect(releaseConsole.route.path).toBe("/operations/release-console");
    expect(releaseConsole.manifest.id).toBe("release-console");
  });
});
