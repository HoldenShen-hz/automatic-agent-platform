import { useMarketplaceQuery } from "@aa/shared-state";
import type { MarketplacePackDTO } from "@aa/shared-types";

export interface MarketplaceVm {
  readonly items: readonly { title: string; description: string }[];
}

export function mapMarketplaceToVm(packs: readonly MarketplacePackDTO[]): MarketplaceVm {
  return {
    items: packs.map((pack) => ({
      title: `${pack.name} · ${pack.version}`,
      description: pack.category,
    })),
  };
}

export function useMarketplaceVm(): MarketplaceVm {
  return mapMarketplaceToVm(useMarketplaceQuery().data ?? []);
}
