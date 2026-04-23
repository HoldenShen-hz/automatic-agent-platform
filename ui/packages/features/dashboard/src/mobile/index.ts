import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { DashboardSnapshotDTO } from "@aa/shared-types";

export function createDashboardMobileCards(snapshot: DashboardSnapshotDTO | null) {
  if (snapshot == null) {
    return [createMobileFeatureCard("Dashboard", "Loading dashboard snapshot", "loading")] as const;
  }
  return [
    createMobileFeatureCard("Health", snapshot.overallHealth, "live"),
    createMobileFeatureCard("Queue", `Depth ${snapshot.queueDepth}`),
    createMobileFeatureCard("Approvals", `Backlog ${snapshot.approvalBacklog}`),
  ] as const;
}
