import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createTakeoverMobileCards() {
    return [
        createMobileFeatureCard("Takeover", "Switch execution to manual control"),
        createMobileFeatureCard("Override", "Apply operator override"),
        createMobileFeatureCard("Resume", "Choose resume mode after takeover"),
    ];
}
