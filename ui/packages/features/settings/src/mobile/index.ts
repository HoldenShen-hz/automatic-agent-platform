import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createSettingsMobileCards(input: {
  readonly locale: string;
  readonly theme: string;
  readonly tenants: number;
  readonly flags: number;
}) {
  return [
    createMobileFeatureCard(translateMessage("ui.settings.mobile.locale"), input.locale),
    createMobileFeatureCard(translateMessage("ui.settings.mobile.theme"), input.theme),
    createMobileFeatureCard(translateMessage("ui.settings.mobile.tenants"), String(input.tenants)),
    createMobileFeatureCard(translateMessage("ui.settings.mobile.featureFlags"), String(input.flags)),
  ] as const;
}
