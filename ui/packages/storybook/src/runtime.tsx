import { useEffect, type PropsWithChildren, type ReactElement } from "react";
import type { Decorator } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { getSharedTranslationService, resetSharedTranslationService } from "@aa/shared-i18n";
import { UiRuntimeProvider } from "@aa/shared-state";
import { applyResolvedTheme } from "@aa/ui-core";

type StorybookThemeName = "light" | "dark" | "high-contrast";

function StorybookUiRuntime(
  {
    children,
    locale,
    route,
    theme,
  }: PropsWithChildren<{ locale: string; route: string; theme: StorybookThemeName }>,
): ReactElement {
  useEffect(() => {
    const service = getSharedTranslationService();
    service.setLocale(locale);
    applyResolvedTheme(theme);
    return () => {
      resetSharedTranslationService();
    };
  }, [locale, theme]);

  return (
    <UiRuntimeProvider authContext={{ permissions: ["*"], roles: ["storybook"], tenantId: "storybook", userId: "storybook" }}>
      <MemoryRouter initialEntries={[route]}>
        {children}
      </MemoryRouter>
    </UiRuntimeProvider>
  );
}

export const withStorybookUiRuntime: Decorator = (Story, context) => {
  const locale = String(context.globals.locale ?? "en-US");
  const route = String(context.globals.route ?? "/mission-control/dashboard");
  const theme = (context.globals.theme ?? "light") as StorybookThemeName;

  return (
    <StorybookUiRuntime locale={locale} route={route} theme={theme}>
      <Story />
    </StorybookUiRuntime>
  );
};
