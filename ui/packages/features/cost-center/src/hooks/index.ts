import { useEffect, useMemo, useState } from "react";
import { useCostReportsQuery } from "@aa/shared-state";
import type { CostReportDTO } from "@aa/shared-types";

export interface CostCenterVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedReport: CostReportDTO | null;
  readonly detailRows: readonly { key: string; value: string }[];
  readonly summaryItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  selectReport(reportId: string): void;
}

export function mapCostReportsToVm(reports: readonly CostReportDTO[]): CostCenterVm {
  const totalSpend = reports.reduce((sum, report) => sum + report.amountUsd, 0);
  const totalBudget = reports.reduce((sum, report) => sum + report.budgetUsd, 0);
  const selectedReport = reports[0] ?? null;

  return {
    metrics: [
      { label: "Reports", value: reports.length },
      { label: "Spend", value: `$${totalSpend.toFixed(2)}` },
      { label: "Budget", value: `$${totalBudget.toFixed(2)}` },
    ],
    listItems: reports.map((report) => ({
      id: report.id,
      title: `${report.scope} · $${report.amountUsd.toFixed(2)}`,
      subtitle: `Budget $${report.budgetUsd.toFixed(2)}`,
    })),
    selectedId: selectedReport?.id ?? null,
    selectedReport,
    detailRows: selectedReport == null ? [] : [
      { key: "Scope", value: selectedReport.scope },
      { key: "Spend", value: `$${selectedReport.amountUsd.toFixed(2)}` },
      { key: "Budget", value: `$${selectedReport.budgetUsd.toFixed(2)}` },
      { key: "Variance", value: `$${(selectedReport.amountUsd - selectedReport.budgetUsd).toFixed(2)}` },
    ],
    summaryItems: [
      {
        title: "Budget feed",
        description: selectedReport == null
          ? "The backend has not published any cost reports yet."
          : `${selectedReport.scope} is currently reporting against the shared backend cost feed.`,
      },
      {
        title: "Contract boundary",
        description: "Budget refresh, drilldown mutation, and export workflow still require promoted cost-control API endpoints.",
      },
    ],
    loading: false,
    selectReport() {},
  };
}

export function useCostCenterVm(): CostCenterVm {
  const costReportsQuery = useCostReportsQuery();
  const reports = costReportsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (reports.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (
      current != null && reports.some((report) => report.id === current)
        ? current
        : reports[0]?.id ?? null
    ));
  }, [reports]);

  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;
  const totalSpend = reports.reduce((sum, report) => sum + report.amountUsd, 0);
  const totalBudget = reports.reduce((sum, report) => sum + report.budgetUsd, 0);

  return {
    metrics: [
      { label: "Reports", value: reports.length },
      { label: "Spend", value: `$${totalSpend.toFixed(2)}` },
      { label: "Budget", value: `$${totalBudget.toFixed(2)}` },
    ],
    listItems: reports.map((report) => ({
      id: report.id,
      title: `${report.scope} · $${report.amountUsd.toFixed(2)}`,
      subtitle: `Budget $${report.budgetUsd.toFixed(2)}`,
    })),
    selectedId,
    selectedReport,
    detailRows: selectedReport == null ? [] : [
      { key: "Scope", value: selectedReport.scope },
      { key: "Spend", value: `$${selectedReport.amountUsd.toFixed(2)}` },
      { key: "Budget", value: `$${selectedReport.budgetUsd.toFixed(2)}` },
      { key: "Variance", value: `$${(selectedReport.amountUsd - selectedReport.budgetUsd).toFixed(2)}` },
    ],
    summaryItems: useMemo(() => [
      {
        title: "Budget feed",
        description: selectedReport == null
          ? "The backend has not published any cost reports yet."
          : `${selectedReport.scope} is currently reporting against the shared backend cost feed.`,
      },
      {
        title: "Contract boundary",
        description: "Budget refresh, drilldown mutation, and export workflow still require promoted cost-control API endpoints.",
      },
    ], [selectedReport]),
    loading: costReportsQuery.isLoading,
    selectReport(reportId: string) {
      setSelectedId(reportId);
    },
  };
}
