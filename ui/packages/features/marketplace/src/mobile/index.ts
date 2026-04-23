import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { MarketplacePackDTO } from "@aa/shared-types";

export function createMarketplaceMobileCards(packs: readonly MarketplacePackDTO[]) {
  return packs.slice(0, 3).map((pack) => createMobileFeatureCard(
    pack.name,
    `${pack.category} · ${pack.version}`,
  ));
}
