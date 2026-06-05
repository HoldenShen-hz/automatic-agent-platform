import { useEffect, useMemo, useState } from "react";
import { useExplanationsQuery } from "@aa/shared-state";
import type { ExplanationDTO } from "@aa/shared-types";

type ExplanationListItem = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
};

type ExplanationDetailRow = {
  readonly key: string;
  readonly value: string;
};

export interface ExplainabilityVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly listItems: readonly ExplanationListItem[];
  readonly selectedId: string | null;
  readonly selectedExplanation: ExplanationDTO | null;
  readonly detailRows: readonly ExplanationDetailRow[];
  readonly summaryItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  selectExplanation(explanationId: string): void;
}

function mapExplanationToListItem(item: ExplanationDTO): ExplanationListItem {
  return {
    id: item.id,
    title: item.title,
    subtitle: `${item.evidenceCount} evidence`,
  };
}

function buildDetailRows(item: ExplanationDTO | null): readonly ExplanationDetailRow[] {
  if (item == null) {
    return [];
  }
  return [
    { key: "Explanation", value: item.title },
    { key: "Evidence Count", value: String(item.evidenceCount) },
    { key: "Summary", value: item.summary },
  ];
}

export function useExplainabilityVm(): ExplainabilityVm {
  const explanationsQuery = useExplanationsQuery();
  const explanations = explanationsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (explanations.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (
      current != null && explanations.some((item) => item.id === current)
        ? current
        : explanations[0]?.id ?? null
    ));
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
        description: selectedExplanation == null
          ? "Select an explanation to inspect the latest backend summary."
          : selectedExplanation.summary,
      },
      {
        title: "Contract boundary",
        description: "Causal-chain expansion and evidence pinning still require a dedicated explainability mutation contract.",
      },
    ], [selectedExplanation]),
    loading: explanationsQuery.isLoading,
    selectExplanation(explanationId: string) {
      setSelectedId(explanationId);
    },
  };
}
