import type { MarketplacePackDTO } from "@aa/shared-types";
export interface MarketplaceVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function mapMarketplaceToVm(packs: readonly MarketplacePackDTO[]): MarketplaceVm;
export declare function useMarketplaceVm(): MarketplaceVm;
