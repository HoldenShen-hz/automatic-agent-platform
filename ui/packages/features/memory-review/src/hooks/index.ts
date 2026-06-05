import { useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { fetchKnowledge } from "@aa/shared-api-client";
import type { KnowledgeItemDTO } from "@aa/shared-types";

type MemoryReviewListItem = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
};

type MemoryReviewDetailRow = {
  readonly key: string;
  readonly value: string;
};

function buildDetailRows(item: KnowledgeItemDTO | null): readonly MemoryReviewDetailRow[] {
  if (item == null) {
    return [];
  }
  return [
    { key: "Knowledge Item", value: item.title },
    { key: "Kind", value: item.kind },
    { key: "Updated At", value: item.updatedAt },
    { key: "Knowledge ID", value: item.id },
  ];
}

export interface MemoryReviewVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly listItems: readonly MemoryReviewListItem[];
  readonly selectedId: string | null;
  readonly detailRows: readonly MemoryReviewDetailRow[];
  readonly summaryItems: readonly { title: string; description: string }[];
  readonly lineageItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly loadError: string | null;
  selectItem(itemId: string): void;
}

export function useMemoryReviewVm(): MemoryReviewVm {
  const client = useRestClient();
  const [knowledgeItems, setKnowledgeItems] = useState<readonly KnowledgeItemDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const nextItems = await fetchKnowledge(client);
        if (!mounted) {
          return;
        }
        setKnowledgeItems(nextItems);
        setSelectedId((current) => (
          current != null && nextItems.some((item) => item.id === current)
            ? current
            : nextItems[0]?.id ?? null
        ));
        setLoadError(null);
      } catch (error: unknown) {
        if (!mounted) {
          return;
        }
        setKnowledgeItems([]);
        setSelectedId(null);
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [client]);

  const selectedItem = knowledgeItems.find((item) => item.id === selectedId) ?? null;

  return {
    metrics: [
      { label: "Knowledge Items", value: knowledgeItems.length },
      { label: "Playbooks", value: knowledgeItems.filter((item) => item.kind === "playbook").length },
      { label: "Artifacts", value: knowledgeItems.filter((item) => item.kind === "artifact").length },
    ],
    listItems: knowledgeItems.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: `${item.kind} · ${item.updatedAt}`,
    })),
    selectedId,
    detailRows: buildDetailRows(selectedItem),
    summaryItems: useMemo(() => [
      {
        title: "Knowledge feed",
        description: selectedItem == null
          ? "No knowledge items are available from the backend."
          : `${selectedItem.title} is loaded from the real knowledge inventory.`,
      },
      {
        title: "Review boundary",
        description: "Memory approve, revoke, and audit export flows still need dedicated memory-governance mutation APIs.",
      },
    ], [selectedItem]),
    lineageItems: selectedItem == null
      ? [{ title: "No lineage", description: "Select a knowledge item to inspect its latest persisted memory record." }]
      : [{
        title: `${selectedItem.kind} lineage`,
        description: `${selectedItem.id} updated at ${selectedItem.updatedAt}`,
      }],
    loading,
    loadError,
    selectItem(itemId: string) {
      setSelectedId(itemId);
    },
  };
}
