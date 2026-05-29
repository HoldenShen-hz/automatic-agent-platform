import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createSettingsMobileCards(input) {
    return [
        createMobileFeatureCard("Locale", input.locale),
        createMobileFeatureCard("Theme", input.theme),
        createMobileFeatureCard("Tenants", String(input.tenants)),
        createMobileFeatureCard("Feature Flags", String(input.flags)),
    ];
}
