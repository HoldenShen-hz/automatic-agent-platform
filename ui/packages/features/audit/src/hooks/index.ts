import { useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { fetchAuditLogs } from "@aa/shared-api-client";

type AuditLogEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: string;
  readonly metadata?: Record<string, unknown>;
};

type AuditListItem = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
};

type AuditDetailRow = {
  readonly key: string;
  readonly value: string;
};

export interface AuditVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly listItems: readonly AuditListItem[];
  readonly selectedId: string | null;
  readonly detailRows: readonly AuditDetailRow[];
  readonly summaryItems: readonly { title: string; description: string }[];
  readonly metadataItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly loadError: string | null;
  selectEntry(entryId: string): void;
}

function buildDetailRows(entry: AuditLogEntry | null): readonly AuditDetailRow[] {
  if (entry == null) {
    return [];
  }
  return [
    { key: "Action", value: entry.action },
    { key: "Actor", value: entry.actor },
    { key: "Resource", value: entry.resource },
    { key: "Outcome", value: entry.outcome },
    { key: "Timestamp", value: entry.timestamp },
    { key: "Entry ID", value: entry.id },
  ];
}

export function useAuditVm(): AuditVm {
  const client = useRestClient();
  const [entries, setEntries] = useState<readonly AuditLogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const nextEntries = [...await fetchAuditLogs(client)].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
        if (!mounted) {
          return;
        }
        setEntries(nextEntries);
        setSelectedId((current) => (
          current != null && nextEntries.some((entry) => entry.id === current)
            ? current
            : nextEntries[0]?.id ?? null
        ));
        setLoadError(null);
      } catch (error: unknown) {
        if (!mounted) {
          return;
        }
        setEntries([]);
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

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const actorCount = new Set(entries.map((entry) => entry.actor)).size;
  const resourceCount = new Set(entries.map((entry) => entry.resource)).size;

  return {
    metrics: [
      { label: "Entries", value: entries.length },
      { label: "Actors", value: actorCount },
      { label: "Resources", value: resourceCount },
    ],
    listItems: entries.map((entry) => ({
      id: entry.id,
      title: `${entry.action} · ${entry.outcome}`,
      subtitle: `${entry.actor} · ${entry.timestamp}`,
    })),
    selectedId,
    detailRows: buildDetailRows(selectedEntry),
    summaryItems: useMemo(() => [
      {
        title: "Audit feed",
        description: selectedEntry == null
          ? "No audit records are available from the backend."
          : `${selectedEntry.action} was recorded for ${selectedEntry.resource}.`,
      },
      {
        title: "Coverage",
        description: `${entries.length} records across ${actorCount} actors and ${resourceCount} resources.`,
      },
      {
        title: "Contract boundary",
        description: "Evidence export bundles and actor-trace pivot routes still need dedicated audit API contracts.",
      },
    ], [actorCount, entries.length, resourceCount, selectedEntry]),
    metadataItems: selectedEntry?.metadata == null || Object.keys(selectedEntry.metadata).length === 0
      ? [{ title: "No metadata", description: "The selected audit record does not expose structured metadata." }]
      : Object.entries(selectedEntry.metadata).map(([key, value]) => ({
        title: key,
        description: typeof value === "string" ? value : JSON.stringify(value),
      })),
    loading,
    loadError,
    selectEntry(entryId: string) {
      setSelectedId(entryId);
    },
  };
}
