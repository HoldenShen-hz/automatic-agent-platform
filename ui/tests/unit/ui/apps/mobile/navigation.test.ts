import { describe, expect, it } from "vitest";
import { mobileNavigation, settingsSubRoutes, type MobileScreenDefinition } from "../../../../../apps/mobile/src/navigation";

describe("mobileNavigation", () => {
  it("defines tabs array", () => {
    expect(Array.isArray(mobileNavigation.tabs)).toBe(true);
    expect(mobileNavigation.tabs.length).toBeGreaterThan(0);
  });

  it("defines modalFlows array", () => {
    expect(Array.isArray(mobileNavigation.modalFlows)).toBe(true);
    expect(mobileNavigation.modalFlows.length).toBeGreaterThan(0);
  });

  describe("tabs configuration", () => {
    it("has dashboard tab", () => {
      const dashboard = mobileNavigation.tabs.find((t) => t.id === "dashboard");
      expect(dashboard).toBeDefined();
      expect(dashboard?.title).toBe("Dashboard");
      expect(dashboard?.requiresAuth).toBe(true);
    });

    it("has tasks tab", () => {
      const tasks = mobileNavigation.tabs.find((t) => t.id === "tasks");
      expect(tasks).toBeDefined();
      expect(tasks?.title).toBe("Tasks");
    });

    it("has approvals tab", () => {
      const approvals = mobileNavigation.tabs.find((t) => t.id === "approvals");
      expect(approvals).toBeDefined();
      expect(approvals?.title).toBe("Approvals");
    });

    it("has conversation tab", () => {
      const conversation = mobileNavigation.tabs.find((t) => t.id === "conversation");
      expect(conversation).toBeDefined();
      expect(conversation?.title).toBe("Conversation");
    });

    it("has settings tab", () => {
      const settings = mobileNavigation.tabs.find((t) => t.id === "settings");
      expect(settings).toBeDefined();
      expect(settings?.title).toBe("Settings");
    });

    it("includes workflow cockpit entry for mobile drill-down", () => {
      const workflowCockpit = mobileNavigation.tabs.find((t) => t.id === "workflow-cockpit");
      expect(workflowCockpit).toBeDefined();
      expect(workflowCockpit?.path).toBe("/mission-control/workflows/:id");
    });

    it("settings tab exposes seven dedicated sub-routes", () => {
      expect(settingsSubRoutes).toHaveLength(7);
      expect(mobileNavigation.settingsSubRoutes).toHaveLength(7);
      expect(mobileNavigation.settingsSubRoutes).toEqual(settingsSubRoutes);
      expect(mobileNavigation.settingsSubRoutes.map((route) => route.id)).toEqual([
        "profile",
        "notifications",
        "security",
        "appearance",
        "language",
        "about",
        "advanced",
      ]);
    });

    it("settings sub-routes stay under the shared settings namespace", () => {
      mobileNavigation.settingsSubRoutes.forEach((route) => {
        expect(route.path.startsWith("/shared/settings/")).toBe(true);
      });
    });

    it("all tabs require authentication", () => {
      mobileNavigation.tabs.forEach((tab) => {
        expect(tab.requiresAuth).toBe(true);
      });
    });

    it("all tabs have valid paths", () => {
      mobileNavigation.tabs.forEach((tab) => {
        expect(tab.path).toBeDefined();
        expect(tab.path.startsWith("/")).toBe(true);
      });
    });

    it("tabs have unique ids", () => {
      const ids = mobileNavigation.tabs.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("modalFlows configuration", () => {
    it("has hitl modal flow", () => {
      const hitl = mobileNavigation.modalFlows.find((m) => m.id === "hitl");
      expect(hitl).toBeDefined();
      expect(hitl?.title).toBe("HITL");
      expect(hitl?.requiresAuth).toBe(true);
    });

    it("has approval-detail modal flow", () => {
      const approvalDetail = mobileNavigation.modalFlows.find(
        (m) => m.id === "approval-detail",
      );
      expect(approvalDetail).toBeDefined();
      expect(approvalDetail?.title).toBe("Approval Detail");
      expect(approvalDetail?.path).toContain(":id");
    });

    it("all modal flows require authentication", () => {
      mobileNavigation.modalFlows.forEach((flow) => {
        expect(flow.requiresAuth).toBe(true);
      });
    });

    it("modal flows have dynamic path parameters", () => {
      const hasDynamicPath = mobileNavigation.modalFlows.some((m) =>
        m.path.includes(":"),
      );
      expect(hasDynamicPath).toBe(true);
    });
  });
});

describe("MobileScreenDefinition interface", () => {
  it("tab entries conform to MobileScreenDefinition", () => {
    const tab = mobileNavigation.tabs[0];
    const screenDef = tab as MobileScreenDefinition;

    expect(typeof screenDef.id).toBe("string");
    expect(typeof screenDef.title).toBe("string");
    expect(typeof screenDef.path).toBe("string");
    expect(typeof screenDef.requiresAuth).toBe("boolean");
  });

  it("modal flow entries conform to MobileScreenDefinition", () => {
    const modal = mobileNavigation.modalFlows[0];
    const screenDef = modal as MobileScreenDefinition;

    expect(typeof screenDef.id).toBe("string");
    expect(typeof screenDef.title).toBe("string");
    expect(typeof screenDef.path).toBe("string");
    expect(typeof screenDef.requiresAuth).toBe("boolean");
  });
});

describe("navigation path structure", () => {
  it("tabs use mission-control paths", () => {
    const missionControlTabs = mobileNavigation.tabs.filter((t) =>
      t.path.startsWith("/mission-control"),
    );
    expect(missionControlTabs.length).toBeGreaterThan(0);
  });

  it("tabs use shared paths for common features", () => {
    const sharedTabs = mobileNavigation.tabs.filter((t) =>
      t.path.startsWith("/shared"),
    );
    expect(sharedTabs.length).toBeGreaterThan(0);
  });

  it("extended features use /extended prefix", () => {
    const extendedFlows = mobileNavigation.modalFlows.filter((m) =>
      m.path.startsWith("/extended"),
    );
    expect(extendedFlows.length).toBeGreaterThan(0);
  });
});

describe("navigation completeness", () => {
  it("covers main user workflows", () => {
    const pathIds = mobileNavigation.tabs.map((t) => t.id);
    const expectedWorkflows = ["dashboard", "tasks", "workflow-cockpit", "approvals", "conversation", "settings"];

    expectedWorkflows.forEach((workflow) => {
      expect(pathIds).toContain(workflow);
    });
  });

  it("modal flows cover overlay interactions", () => {
    const flowIds = mobileNavigation.modalFlows.map((m) => m.id);
    expect(flowIds).toContain("hitl");
    expect(flowIds).toContain("approval-detail");
  });
});
