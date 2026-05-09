export interface MobileScreenDefinition {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly requiresAuth: boolean;
}

export const settingsSubRoutes = [
  { id: "profile", title: "Profile", path: "/shared/settings/profile", requiresAuth: true },
  { id: "notifications", title: "Notifications", path: "/shared/settings/notifications", requiresAuth: true },
  { id: "security", title: "Security", path: "/shared/settings/security", requiresAuth: true },
  { id: "appearance", title: "Appearance", path: "/shared/settings/appearance", requiresAuth: true },
  { id: "language", title: "Language", path: "/shared/settings/language", requiresAuth: true },
  { id: "about", title: "About", path: "/shared/settings/about", requiresAuth: true },
  { id: "advanced", title: "Advanced", path: "/shared/settings/advanced", requiresAuth: true },
] satisfies readonly MobileScreenDefinition[];

export const mobileNavigation = {
  tabs: [
    { id: "dashboard", title: "Dashboard", path: "/mission-control/dashboard", requiresAuth: true },
    { id: "tasks", title: "Tasks", path: "/mission-control/tasks", requiresAuth: true },
    { id: "workflow-cockpit", title: "Workflow Cockpit", path: "/mission-control/workflows/:id", requiresAuth: true },
    { id: "approvals", title: "Approvals", path: "/mission-control/approvals", requiresAuth: true },
    { id: "conversation", title: "Conversation", path: "/extended/conversation", requiresAuth: true },
    { id: "settings", title: "Settings", path: "/shared/settings", requiresAuth: true },
  ] satisfies readonly MobileScreenDefinition[],
  settingsSubRoutes,
  modalFlows: [
    { id: "hitl", title: "HITL", path: "/extended/hitl", requiresAuth: true },
    { id: "approval-detail", title: "Approval Detail", path: "/mission-control/approvals/:id", requiresAuth: true },
  ] satisfies readonly MobileScreenDefinition[],
};
