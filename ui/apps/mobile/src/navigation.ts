export interface MobileScreenDefinition {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly requiresAuth: boolean;
}

export const mobileNavigation = {
  tabs: [
    { id: "dashboard", title: "Dashboard", path: "/mission-control/dashboard", requiresAuth: true },
    { id: "tasks", title: "Tasks", path: "/mission-control/tasks", requiresAuth: true },
    { id: "approvals", title: "Approvals", path: "/mission-control/approvals", requiresAuth: true },
    { id: "conversation", title: "Conversation", path: "/extended/conversation", requiresAuth: true },
    { id: "settings", title: "Settings", path: "/shared/settings", requiresAuth: true },
  ] satisfies readonly MobileScreenDefinition[],
  modalFlows: [
    { id: "hitl", title: "HITL", path: "/extended/hitl", requiresAuth: true },
    { id: "approval-detail", title: "Approval Detail", path: "/mission-control/approvals/:id", requiresAuth: true },
  ] satisfies readonly MobileScreenDefinition[],
};
