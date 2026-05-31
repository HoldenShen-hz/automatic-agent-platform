import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";
import type { DashboardSnapshotDTO } from "@aa/shared-types";

export function createDashboardMobileCards(snapshot: DashboardSnapshotDTO | null) {
  if (snapshot == null) {
    return [
      createMobileFeatureCard(
        translateMessage("ui.dashboard.mobile.loading.title"),
        translateMessage("ui.dashboard.mobile.loading.description"),
        "loading",
      ),
    ] as const;
  }
  return [
    createMobileFeatureCard(translateMessage("ui.dashboard.mobile.health.title"), snapshot.overallHealth, "live"),
    createMobileFeatureCard(
      translateMessage("ui.dashboard.mobile.queue.title"),
      translateMessage("ui.dashboard.mobile.queue.description", { depth: snapshot.queueDepth }),
    ),
    createMobileFeatureCard(
      translateMessage("ui.dashboard.mobile.approvals.title"),
      translateMessage("ui.dashboard.mobile.approvals.description", { backlog: snapshot.approvalBacklog }),
    ),
  ] as const;
}
