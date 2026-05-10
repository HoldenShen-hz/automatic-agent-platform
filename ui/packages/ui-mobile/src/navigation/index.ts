import type { MobileScreenDescriptor } from "../components";

export const mobileNavigationBaseline = [
  { tab: "home", title: "Dashboard" },
  { tab: "tasks", title: "Tasks" },
  { tab: "approvals", title: "Approvals" },
  { tab: "dashboard", title: "Dashboard" },
  { tab: "more", title: "More" },
] as const;

export function buildMobileRouteMap(screens: readonly MobileScreenDescriptor[]) {
  return screens.reduce<Record<string, readonly string[]>>((accumulator, screen) => {
    const current = accumulator[screen.tab] ?? [];
    return {
      ...accumulator,
      [screen.tab]: [...current, screen.featureId],
    };
  }, {});
}
