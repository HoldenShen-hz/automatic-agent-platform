import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createMarketplaceMobileCards(packs) {
    return packs.slice(0, 3).map((pack) => createMobileFeatureCard(pack.name, `${pack.category} · ${pack.version}`));
}
