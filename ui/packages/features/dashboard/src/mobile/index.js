import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createDashboardMobileCards(snapshot) {
    if (snapshot == null) {
        return [createMobileFeatureCard("Dashboard", "Loading dashboard snapshot", "loading")];
    }
    return [
        createMobileFeatureCard("Health", snapshot.overallHealth, "live"),
        createMobileFeatureCard("Queue", `Depth ${snapshot.queueDepth}`),
        createMobileFeatureCard("Approvals", `Backlog ${snapshot.approvalBacklog}`),
    ];
}
