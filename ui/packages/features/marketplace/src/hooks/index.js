import { useEffect, useMemo, useState } from "react";
import { useMarketplaceQuery } from "@aa/shared-state";
function mapPackToListItem(pack) {
    return {
        id: pack.id,
        title: `${pack.name} · ${pack.version}`,
        subtitle: pack.category,
    };
}
function buildDetailRows(pack) {
    if (pack == null) {
        return [];
    }
    return [
        { key: "Pack", value: pack.name },
        { key: "Version", value: pack.version },
        { key: "Category", value: pack.category },
        { key: "ID", value: pack.id },
    ];
}
export function useMarketplaceVm() {
    const marketplaceQuery = useMarketplaceQuery();
    const packs = marketplaceQuery.data ?? [];
    const [selectedId, setSelectedId] = useState(null);
    useEffect(() => {
        if (packs.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId((current) => (current != null && packs.some((pack) => pack.id === current)
            ? current
            : packs[0]?.id ?? null));
    }, [packs]);
    const selectedPack = packs.find((pack) => pack.id === selectedId) ?? null;
    const categoryCount = new Set(packs.map((pack) => pack.category)).size;
    return {
        metrics: [
            { label: "Packs", value: packs.length },
            { label: "Categories", value: categoryCount },
        ],
        listItems: packs.map(mapPackToListItem),
        selectedId,
        selectedPack,
        detailRows: buildDetailRows(selectedPack),
        summaryItems: useMemo(() => [
            {
                title: "Catalog feed",
                description: selectedPack == null
                    ? "The backend has not published any marketplace packs yet."
                    : `${selectedPack.name} is visible in the shared marketplace catalog.`,
            },
            {
                title: "Install workflow",
                description: "Pack install approval remains unavailable until a marketplace mutation route is promoted into the API contract.",
            },
        ], [selectedPack]),
        loading: marketplaceQuery.isLoading,
        selectPack(packId) {
            setSelectedId(packId);
        },
    };
}
