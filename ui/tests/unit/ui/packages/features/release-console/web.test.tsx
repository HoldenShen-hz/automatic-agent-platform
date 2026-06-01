// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FeatureWorkbenchPanel: (
    { items, actions }: {
      items: Array<{ title: string; description: string }>;
      actions: Array<{ id: string; label: string; onTrigger?: () => void | Promise<void> }>;
    },
  ) => (
    <div>
      {items.map((item) => <div key={item.title}>{item.title}</div>)}
      {actions.map((action) => <button key={action.id} type="button" onClick={() => void action.onTrigger?.()}>{action.label}</button>)}
    </div>
  ),
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}:${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={item.title}>{item.title}</div>)}</div>
  ),
  buildWorkbenchActionHandler: () => () => undefined,
}));

vi.mock("../../../../../../packages/features/release-console/src/hooks", () => ({
  useReleaseConsoleVm: () => ({
    items: [{ title: "Manifest Draft Queue", description: "desc" }],
    loading: false,
    mutating: false,
    summaryRows: [
      { key: "Families", value: "2" },
      { key: "Approved claims", value: "1" },
    ],
    errorMessage: null,
    approveReviewRequest: vi.fn(async () => undefined),
    rejectReviewRequest: vi.fn(async () => undefined),
    revokeClaim: vi.fn(async () => undefined),
    leadershipClaims: {
      generatedAt: "2026-05-31T00:00:00.000Z",
      families: [{ familyId: "engineering", displayName: "Engineering", readinessStatus: "local_leadership_ready", targetClaimLevel: "local_leader", owner: "owner", canonicalFamilies: [], canonicalDivisions: ["coding"], benchmarkRefs: [], minimumEvidenceRef: "engineering-core", notes: "", benchmarks: [], internalMappings: [], mvpThresholds: [], leadershipThresholds: [] }],
      claims: [{ claimId: "claim-1", familyId: "engineering", divisionId: "coding", scenarioId: "issue", claimLevel: "local_leader", claimText: "claim text", allowedSurfaces: ["docs"], evidenceRefs: [], reviewedBy: [], expiresAt: null, status: "approved", effectiveStatus: "approved", effectiveStatusReasonCode: null, revokedBy: null, revokedAt: null, replacementRequired: false }],
      allowlist: [],
      scannerHits: [{ filePath: "docs_zh/reference/release.md", matchedText: "claim-term", lineNumber: 9, excerpt: "claim wording", surface: "docs", status: "allowlisted", claimId: null, reason: "governance_rule_definition" }],
      scannerGeneratedAt: "2026-05-31T00:00:00.000Z",
      reviewRequests: [{ requestId: "review-1", familyId: "engineering", divisionId: "coding", scenarioId: "issue", requestedClaimLevel: "local_leader", requestedSurfaces: ["docs"], requestedBy: "release-owner", rationale: "rationale", requestedAt: "2026-05-31T00:00:00.000Z", status: "pending", reviewedBy: null, reviewedAt: null, decisionReasonCode: null, decisionComment: null }],
      noGoActions: [{ familyId: null, id: "no-auto-payment", description: "No automated payment", riskClass: "R5", scopes: [], enforcementSurfaces: [], blockModes: ["autonomous_execution"] }],
      summary: { familyCount: 2, approvedClaimCount: 1, expiringClaimCount: 1, pendingReviewRequestCount: 1, blockedScannerHitCount: 0, expiredAllowlistCount: 0, revokedClaimCount: 0, expiredClaimCount: 0 },
    },
  }),
}));

import { LeadershipClaimsWebView, ReleaseConsoleWebView } from "../../../../../../packages/features/release-console/src/web";

afterEach(() => {
  cleanup();
});

describe("ReleaseConsoleWebView", () => {
  it("renders workbench actions and governance summary", () => {
    render(<ReleaseConsoleWebView />);

    expect(screen.queryByText("运行门禁")).not.toBeNull();
    expect(screen.queryByText("查看声明治理")).not.toBeNull();
    expect(screen.queryByText("Manifest Draft Queue")).not.toBeNull();
    expect(screen.queryByText("Families:2")).not.toBeNull();
    expect(screen.queryByText("Engineering")).not.toBeNull();
  });
});

describe("LeadershipClaimsWebView", () => {
  it("renders families, claims, scanner hits, review requests, and no-go actions", () => {
    render(<LeadershipClaimsWebView />);

    expect(screen.queryByText("Family readiness")).not.toBeNull();
    expect(screen.queryByText("Engineering · local_leadership_ready")).not.toBeNull();
    expect(screen.queryByText("engineering · local_leader · approved")).not.toBeNull();
    expect(screen.queryByText("allowlisted · claim-term")).not.toBeNull();
    expect(screen.queryByText("engineering · local_leader · pending")).not.toBeNull();
    expect(screen.queryByText("no-auto-payment · R5")).not.toBeNull();
    expect(screen.queryByText("Approve review")).not.toBeNull();
    expect(screen.queryByText("Revoke claim")).not.toBeNull();
  });
});
