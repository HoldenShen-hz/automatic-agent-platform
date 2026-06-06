// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const divisionInventoryVmMock = vi.hoisted(() => ({
  useDivisionInventoryVm: vi.fn(),
}));

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}:${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={item.title}>{`${item.title} ${item.description}`}</div>)}</div>
  ),
}));

vi.mock("../../../../../../packages/features/division-inventory/src/hooks", () => ({
  useDivisionInventoryVm: divisionInventoryVmMock.useDivisionInventoryVm,
}));

import { DivisionInventoryWebView } from "../../../../../../packages/features/division-inventory/src/web";

function createVmOverride(overrides: Partial<ReturnType<typeof divisionInventoryVmMock.useDivisionInventoryVm>> = {}) {
  return {
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
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  divisionInventoryVmMock.useDivisionInventoryVm.mockReset();
});

describe("DivisionInventoryWebView", () => {
  it("renders summary and inventory entries", () => {
    divisionInventoryVmMock.useDivisionInventoryVm.mockReturnValue(createVmOverride());
    render(<DivisionInventoryWebView />);

    expect(screen.queryByText("Divisions:3")).not.toBeNull();
    expect(screen.queryByText(/coding · pilot_ready/)).not.toBeNull();
    expect(screen.queryByText(/legal · coverage_draft/)).not.toBeNull();
    expect(screen.queryByText(/#b45309|#9f1239|#166534/)).toBeNull();
  });

  it("renders filters", () => {
    divisionInventoryVmMock.useDivisionInventoryVm.mockReturnValue(createVmOverride());
    render(<DivisionInventoryWebView />);
    expect(screen.getByLabelText("Family")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gtm-content" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Risk")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Blockers only"));
  });

  it("renders an explicit empty state when filters match no divisions", () => {
    divisionInventoryVmMock.useDivisionInventoryVm.mockReturnValue(createVmOverride({
      filteredRecords: [],
    }));

    render(<DivisionInventoryWebView />);

    expect(screen.getByText("No divisions match the current filters.")).toBeInTheDocument();
  });
});
