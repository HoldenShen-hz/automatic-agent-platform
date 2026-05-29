import { useMarketplaceQuery } from "@aa/shared-state";
export function mapMarketplaceToVm(packs) {
    return {
        items: packs.map((pack) => ({
            title: `${pack.name} · ${pack.version}`,
            description: pack.category,
        })),
    };
}
export function useMarketplaceVm() {
    return mapMarketplaceToVm(useMarketplaceQuery().data ?? []);
}
