import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createSettingsMobileCards(input: {
  readonly locale: string;
  readonly theme: string;
  readonly tenants: number;
  readonly flags: number;
}) {
  return [
    createMobileFeatureCard("Locale", input.locale),
    createMobileFeatureCard("Theme", input.theme),
    createMobileFeatureCard("Tenants", String(input.tenants)),
    createMobileFeatureCard("Feature Flags", String(input.flags)),
  ] as const;
}
