import { useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { fetchAuditLogs } from "@aa/shared-api-client";
function buildDetailRows(entry) {
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
export function useAuditVm() {
    const client = useRestClient();
    const [entries, setEntries] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
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
                setSelectedId((current) => (current != null && nextEntries.some((entry) => entry.id === current)
                    ? current
                    : nextEntries[0]?.id ?? null));
                setLoadError(null);
            }
            catch (error) {
                if (!mounted) {
                    return;
                }
                setEntries([]);
                setSelectedId(null);
                setLoadError(error instanceof Error ? error.message : String(error));
            }
            finally {
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
        selectEntry(entryId) {
            setSelectedId(entryId);
        },
    };
}
