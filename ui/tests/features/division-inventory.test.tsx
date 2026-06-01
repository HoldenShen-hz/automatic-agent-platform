import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import divisionInventoryFeature from "../../packages/features/division-inventory/src/index";

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => ({ get: vi.fn(), post: vi.fn() }),
}));

vi.mock("@aa/shared-api-client", () => ({
  fetchDivisionInventorySnapshot: vi.fn(async () => ({
    generatedAt: "2026-06-01T00:00:00.000Z",
    records: [],
    summary: {
      totalDivisions: 32,
      p0Divisions: 5,
      blockedDivisions: 0,
      orphanSourceModules: 0,
    },
  })),
}));

describe("division inventory feature", () => {
  it("renders the division inventory contract", () => {
    render(<divisionInventoryFeature.Component />);

    expect(screen.getByText("Division Inventory")).toBeInTheDocument();
    expect(divisionInventoryFeature.route.path).toBe("/governance/division-inventory");
    expect(divisionInventoryFeature.manifest.id).toBe("division-inventory");
  });
});
