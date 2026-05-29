export const settingsSubRoutes = [
    { id: "profile", title: "Profile", path: "/shared/settings/profile", requiresAuth: true },
    { id: "notifications", title: "Notifications", path: "/shared/settings/notifications", requiresAuth: true },
    { id: "security", title: "Security", path: "/shared/settings/security", requiresAuth: true },
    { id: "appearance", title: "Appearance", path: "/shared/settings/appearance", requiresAuth: true },
    { id: "language", title: "Language", path: "/shared/settings/language", requiresAuth: true },
    { id: "about", title: "About", path: "/shared/settings/about", requiresAuth: true },
    { id: "advanced", title: "Advanced", path: "/shared/settings/advanced", requiresAuth: true },
];
const tabRoutes = [
    { id: "dashboard", title: "Dashboard", path: "/mission-control/dashboard", requiresAuth: true },
    { id: "tasks", title: "Tasks", path: "/mission-control/tasks", requiresAuth: true },
    { id: "workflow-cockpit", title: "Workflow Cockpit", path: "/mission-control/workflows/:id", requiresAuth: true },
    { id: "approvals", title: "Approvals", path: "/mission-control/approvals", requiresAuth: true },
    { id: "conversation", title: "Conversation", path: "/mission-control/conversation", requiresAuth: true },
    { id: "settings", title: "Settings", path: "/shared/settings", requiresAuth: true },
];
const modalRoutes = [
    { id: "hitl", title: "HITL", path: "/extended/hitl", requiresAuth: true },
    { id: "approval-detail", title: "Approval Detail", path: "/mission-control/approvals/:id", requiresAuth: true },
];
export const rootTabNavigator = {
    kind: "tab",
    navigatorId: "root-tabs",
    initialRouteId: "dashboard",
    routes: tabRoutes,
};
export const settingsStack = {
    kind: "stack",
    navigatorId: "settings-stack",
    initialRouteId: "profile",
    presentation: "card",
    routes: settingsSubRoutes,
};
export const modalNavigator = {
    kind: "stack",
    navigatorId: "modal-stack",
    initialRouteId: "hitl",
    presentation: "modal",
    routes: modalRoutes,
};
export const mobileNavigation = {
    tabs: rootTabNavigator.routes,
    rootTabNavigator,
    settingsStack,
    settingsSubRoutes,
    modalNavigator,
    modalFlows: modalNavigator.routes,
};
export function resolveMobileScreen(screenId) {
    return [
        ...mobileNavigation.tabs,
        ...mobileNavigation.settingsSubRoutes,
        ...mobileNavigation.modalFlows,
    ].find((screen) => screen.id === screenId) ?? null;
}
