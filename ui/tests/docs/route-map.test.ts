import { describe, expect, it } from "vitest";
import { featureRegistry } from "../../apps/web/src/feature-registry";

describe("ui route map", () => {
  it("covers the core documented implemented-first routes", () => {
    const routes = featureRegistry.map((feature) => feature.route.path);
    for (const requiredRoute of [
      "/mission-control/dashboard",
      "/mission-control/tasks",
      "/mission-control/workflows",
      "/mission-control/approvals",
      "/mission-control/alerts",
      "/mission-control/stability",
      "/operations/dispatch",
      "/operations/inspect",
      "/operations/health",
      "/operations/incidents",
      "/governance/policy",
      "/governance/audit",
      "/governance/compliance",
      "/admin/takeover",
      "/admin/workers",
      "/admin/queues",
      "/mission-control/conversation",
      "/extended/hitl",
      "/shared/domain-wizard",
      "/shared/settings",
    ]) {
      expect(routes).toContain(requiredRoute);
    }
  });
});
