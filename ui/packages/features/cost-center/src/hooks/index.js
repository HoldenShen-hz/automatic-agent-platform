import { useEffect, useMemo, useState } from "react";
import { useCostReportsQuery } from "@aa/shared-state";
export function mapCostReportsToVm(reports) {
    const totalSpend = reports.reduce((sum, report) => sum + report.amountUsd, 0);
    const totalBudget = reports.reduce((sum, report) => sum + (report.budgetUsd ?? 0), 0);
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
            subtitle: report.budgetUsd == null ? "Budget not published" : `Budget $${report.budgetUsd.toFixed(2)}`,
        })),
        selectedId: selectedReport?.id ?? null,
        selectedReport,
        detailRows: selectedReport == null ? [] : [
            { key: "Scope", value: selectedReport.scope },
            { key: "Spend", value: `$${selectedReport.amountUsd.toFixed(2)}` },
            { key: "Budget", value: selectedReport.budgetUsd == null ? "Not published" : `$${selectedReport.budgetUsd.toFixed(2)}` },
            { key: "Variance", value: selectedReport.budgetUsd == null ? "n/a" : `$${(selectedReport.amountUsd - selectedReport.budgetUsd).toFixed(2)}` },
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
                description: selectedReport?.budgetUsd == null
                    ? "The backend cost feed is live, but budget envelopes are not published on this endpoint yet."
                    : "Budget refresh, drilldown mutation, and export workflow still require promoted cost-control API endpoints.",
            },
        ],
        loading: false,
        selectReport() { },
    };
}
export function useCostCenterVm() {
    const costReportsQuery = useCostReportsQuery();
    const reports = costReportsQuery.data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    useEffect(() => {
        if (reports.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId((current) => (current != null && reports.some((report) => report.id === current)
            ? current
            : reports[0]?.id ?? null));
    }, [reports]);
    const selectedReport = reports.find((report) => report.id === selectedId) ?? null;
    const totalSpend = reports.reduce((sum, report) => sum + report.amountUsd, 0);
    const totalBudget = reports.reduce((sum, report) => sum + (report.budgetUsd ?? 0), 0);
    return {
        metrics: [
            { label: "Reports", value: reports.length },
            { label: "Spend", value: `$${totalSpend.toFixed(2)}` },
            { label: "Budget", value: `$${totalBudget.toFixed(2)}` },
        ],
        listItems: reports.map((report) => ({
            id: report.id,
            title: `${report.scope} · $${report.amountUsd.toFixed(2)}`,
            subtitle: report.budgetUsd == null ? "Budget not published" : `Budget $${report.budgetUsd.toFixed(2)}`,
        })),
        selectedId,
        selectedReport,
        detailRows: selectedReport == null ? [] : [
            { key: "Scope", value: selectedReport.scope },
            { key: "Spend", value: `$${selectedReport.amountUsd.toFixed(2)}` },
            { key: "Budget", value: selectedReport.budgetUsd == null ? "Not published" : `$${selectedReport.budgetUsd.toFixed(2)}` },
            { key: "Variance", value: selectedReport.budgetUsd == null ? "n/a" : `$${(selectedReport.amountUsd - selectedReport.budgetUsd).toFixed(2)}` },
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
                description: selectedReport?.budgetUsd == null
                    ? "The backend cost feed is live, but budget envelopes are not published on this endpoint yet."
                    : "Budget refresh, drilldown mutation, and export workflow still require promoted cost-control API endpoints.",
            },
        ], [selectedReport]),
        loading: costReportsQuery.isLoading,
        selectReport(reportId) {
            setSelectedId(reportId);
        },
    };
}
