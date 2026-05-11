import type { MobileScreenDescriptor } from "../components";

export const mobileNavigationBaseline = [
  { tab: "dashboard", title: "Dashboard" },
  { tab: "tasks", title: "Tasks" },
  { tab: "workflow-cockpit", title: "Workflow Cockpit" },
  { tab: "approvals", title: "Approvals" },
  { tab: "conversation", title: "Conversation" },
  { tab: "settings", title: "Settings" },
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
