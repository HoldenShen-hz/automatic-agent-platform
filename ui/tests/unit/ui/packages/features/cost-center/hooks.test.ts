import { describe, expect, it } from "vitest";
import { mapCostReportsToVm } from "../../../../../../packages/features/cost-center/src/hooks";

describe("mapCostReportsToVm", () => {
  it("handles backend cost reports that do not publish budget envelopes", () => {
    const vm = mapCostReportsToVm([
      {
        id: "cost-report-1",
        scope: "2026-06-01 -> 2026-06-05",
        amountUsd: 14.25,
        budgetUsd: null,
        currency: "USD",
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-06-05T00:00:00.000Z",
        resourceCount: 1,
        submittedBy: "local-dev-operator",
      },
    ]);

    expect(vm.metrics).toEqual([
      { label: "Reports", value: 1 },
      { label: "Spend", value: "$14.25" },
      { label: "Budget", value: "$0.00" },
    ]);
    expect(vm.listItems[0]?.subtitle).toBe("Budget not published");
    expect(vm.detailRows).toContainEqual({ key: "Budget", value: "Not published" });
    expect(vm.detailRows).toContainEqual({ key: "Variance", value: "n/a" });
    expect(vm.summaryItems[1]?.description).toContain("budget envelopes are not published");
  });
});
