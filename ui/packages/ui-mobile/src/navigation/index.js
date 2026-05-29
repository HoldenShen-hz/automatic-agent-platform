export const mobileNavigationBaseline = [
    { tab: "dashboard", title: "Dashboard" },
    { tab: "tasks", title: "Tasks" },
    { tab: "workflow-cockpit", title: "Workflow Cockpit" },
    { tab: "approvals", title: "Approvals" },
    { tab: "conversation", title: "Conversation" },
    { tab: "settings", title: "Settings" },
];
export function buildMobileRouteMap(screens) {
    return screens.reduce((accumulator, screen) => {
        const current = accumulator[screen.tab] ?? [];
        return {
            ...accumulator,
            [screen.tab]: [...current, screen.featureId],
        };
    }, {});
}
