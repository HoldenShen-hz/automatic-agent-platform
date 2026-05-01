export interface MobileScreenDefinition {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly requiresAuth: boolean;
}

export interface SettingsSubRoute {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

export const settingsSubRoutes: readonly SettingsSubRoute[] = [
  { id: "profile", title: "Profile", path: "/shared/settings/profile" },
  { id: "notifications", title: "Notifications", path: "/shared/settings/notifications" },
  { id: "security", title: "Security", path: "/shared/settings/security" },
  { id: "appearance", title: "Appearance", path: "/shared/settings/appearance" },
  { id: "language", title: "Language", path: "/shared/settings/language" },
  { id: "about", title: "About", path: "/shared/settings/about" },
  { id: "advanced", title: "Advanced", path: "/shared/settings/advanced" },
] as const;

export const mobileNavigation = {
  tabs: [
    { id: "dashboard", title: "Dashboard", path: "/mission-control/dashboard", requiresAuth: true },
    { id: "tasks", title: "Tasks", path: "/mission-control/tasks", requiresAuth: true },
    { id: "workflows", title: "Workflows", path: "/mission-control/workflows", requiresAuth: true },
    { id: "approvals", title: "Approvals", path: "/mission-control/approvals", requiresAuth: true },
    { id: "conversation", title: "Conversation", path: "/extended/conversation", requiresAuth: true },
    { id: "settings", title: "Settings", path: "/shared/settings", requiresAuth: true },
  ] satisfies readonly MobileScreenDefinition[],
  modalFlows: [
    { id: "hitl", title: "HITL", path: "/extended/hitl", requiresAuth: true },
    { id: "approval-detail", title: "Approval Detail", path: "/mission-control/approvals/:id", requiresAuth: true },
  ] satisfies readonly MobileScreenDefinition[],
};
