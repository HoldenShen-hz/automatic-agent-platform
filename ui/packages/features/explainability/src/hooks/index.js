import { useEffect, useMemo, useState } from "react";
import { useExplanationsQuery } from "@aa/shared-state";
function mapExplanationToListItem(item) {
    return {
        id: item.id,
        title: item.title,
        subtitle: `${item.evidenceCount} evidence`,
    };
}
function buildDetailRows(item) {
    if (item == null) {
        return [];
    }
    return [
        { key: "Explanation", value: item.title },
        { key: "Evidence Count", value: String(item.evidenceCount) },
        { key: "Summary", value: item.summary },
    ];
}
export function useExplainabilityVm() {
    const explanationsQuery = useExplanationsQuery();
    const explanations = explanationsQuery.data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    useEffect(() => {
        if (explanations.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId((current) => (current != null && explanations.some((item) => item.id === current)
            ? current
            : explanations[0]?.id ?? null));
    }, [explanations]);
    const selectedExplanation = explanations.find((item) => item.id === selectedId) ?? null;
    return {
        metrics: [
            { label: "Explanations", value: explanations.length },
            { label: "Evidence", value: explanations.reduce((sum, item) => sum + item.evidenceCount, 0) },
        ],
        listItems: explanations.map(mapExplanationToListItem),
        selectedId,
        selectedExplanation,
        detailRows: buildDetailRows(selectedExplanation),
        summaryItems: useMemo(() => [
            {
                title: "Live explanation feed",
                description: explanations.length === 0
                    ? "No explanations are available from the backend."
                    : selectedExplanation == null
                        ? "Select an explanation to inspect the latest backend summary."
                        : selectedExplanation.summary,
            },
            {
                title: "Contract boundary",
                description: "Causal-chain expansion and evidence pinning still require a dedicated explainability mutation contract.",
            },
        ], [explanations.length, selectedExplanation]),
        loading: explanationsQuery.isLoading,
        selectExplanation(explanationId) {
            setSelectedId(explanationId);
        },
    };
}
