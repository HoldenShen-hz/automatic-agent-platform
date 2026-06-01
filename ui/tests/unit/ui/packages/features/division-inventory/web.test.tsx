// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}:${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={item.title}>{item.title}</div>)}</div>
  ),
}));

vi.mock("../../../../../../packages/features/division-inventory/src/hooks", () => ({
  useDivisionInventoryVm: () => ({
    loading: false,
    snapshot: null,
    summaryRows: [
      { key: "Divisions", value: "3" },
      { key: "Blocked divisions", value: "1" },
    ],
    familyOptions: ["all", "engineering", "regulated", "gtm-content"],
    familyFilter: "all",
    statusFilter: "all",
    riskFilter: "all",
    blockerOnly: false,
    filteredRecords: [
      { divisionId: "coding", familyId: "engineering", status: "pilot_ready", riskLevel: "high", hasCoverageCard: true, hasEval: true, hasRedTeam: true, blockers: [] },
      { divisionId: "legal", familyId: "regulated", status: "coverage_draft", riskLevel: "critical", hasCoverageCard: true, hasEval: false, hasRedTeam: false, blockers: ["missing_eval"] },
    ],
    setFamilyFilter: vi.fn(),
    setStatusFilter: vi.fn(),
    setRiskFilter: vi.fn(),
    setBlockerOnly: vi.fn(),
  }),
}));

import { DivisionInventoryWebView } from "../../../../../../packages/features/division-inventory/src/web";

afterEach(() => {
  cleanup();
});

describe("DivisionInventoryWebView", () => {
  it("renders summary and inventory entries", () => {
    render(<DivisionInventoryWebView />);

    expect(screen.queryByText("Divisions:3")).not.toBeNull();
    expect(screen.queryByText("coding · pilot_ready")).not.toBeNull();
    expect(screen.queryByText("legal · coverage_draft")).not.toBeNull();
  });

  it("renders filters", () => {
    render(<DivisionInventoryWebView />);
    expect(screen.getByLabelText("Family")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gtm-content" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Risk")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Blockers only"));
  });
});
