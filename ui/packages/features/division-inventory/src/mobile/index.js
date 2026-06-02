import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createDivisionInventoryMobileCards(input) {
    return [
        createMobileFeatureCard("Divisions", String(input.totalDivisions)),
        createMobileFeatureCard("Blocked", String(input.blockedDivisions)),
        createMobileFeatureCard("Orphans", String(input.orphanSourceModules)),
    ];
}
