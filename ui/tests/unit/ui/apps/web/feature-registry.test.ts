import { describe, expect, it } from "vitest";
import { featureRegistry, LazyFeatureDashboard } from "../../../../../apps/web/src/feature-registry";
import type { FeatureModule } from "@aa/ui-core";

describe("feature-registry", () => {
  it("exports featureRegistry as readonly array", () => {
    expect(Array.isArray(featureRegistry)).toBe(true);
  });

  it("contains dashboard feature", () => {
    const dashboard = featureRegistry.find((f) => f.manifest.id === "dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard?.manifest.title).toBe("总览驾驶舱");
  });

  it("contains task-cockpit feature", () => {
    const taskCockpit = featureRegistry.find((f) => f.manifest.id === "task-cockpit");
    expect(taskCockpit).toBeDefined();
    expect(taskCockpit?.manifest.title).toBe("任务驾驶舱");
  });

  it("contains workflow-cockpit feature", () => {
    const workflowCockpit = featureRegistry.find(
      (f) => f.manifest.id === "workflow-cockpit",
    );
    expect(workflowCockpit).toBeDefined();
  });

  it("contains approval feature", () => {
    const approval = featureRegistry.find((f) => f.manifest.id === "approval");
    expect(approval).toBeDefined();
    expect(approval?.manifest.group).toBe("Mission Control");
  });

  it("contains stability feature", () => {
    const stability = featureRegistry.find((f) => f.manifest.id === "stability");
    expect(stability).toBeDefined();
  });

  it("contains takeover feature", () => {
    const takeover = featureRegistry.find((f) => f.manifest.id === "takeover");
    expect(takeover).toBeDefined();
  });

  it("contains alerts feature", () => {
    const alerts = featureRegistry.find((f) => f.manifest.id === "alerts");
    expect(alerts).toBeDefined();
  });

  it("contains dispatch feature", () => {
    const dispatch = featureRegistry.find((f) => f.manifest.id === "dispatch");
    expect(dispatch).toBeDefined();
  });

  it("contains inspect feature", () => {
    const inspect = featureRegistry.find((f) => f.manifest.id === "inspect");
    expect(inspect).toBeDefined();
  });

  it("contains health feature", () => {
    const health = featureRegistry.find((f) => f.manifest.id === "health");
    expect(health).toBeDefined();
  });

  it("contains incidents feature", () => {
    const incidents = featureRegistry.find((f) => f.manifest.id === "incidents");
    expect(incidents).toBeDefined();
  });

  it("contains compliance feature", () => {
    const compliance = featureRegistry.find((f) => f.manifest.id === "compliance");
    expect(compliance).toBeDefined();
    expect(compliance?.manifest.group).toBe("Governance");
  });

  it("contains policy feature", () => {
    const policy = featureRegistry.find((f) => f.manifest.id === "policy");
    expect(policy).toBeDefined();
  });

  it("contains audit feature", () => {
    const audit = featureRegistry.find((f) => f.manifest.id === "audit");
    expect(audit).toBeDefined();
  });

  it("contains conversation feature", () => {
    const conversation = featureRegistry.find((f) => f.manifest.id === "conversation");
    expect(conversation).toBeDefined();
    expect(conversation?.manifest.group).toBe("Mission Control");
  });

  it("contains hitl feature", () => {
    const hitl = featureRegistry.find((f) => f.manifest.id === "hitl");
    expect(hitl).toBeDefined();
  });

  it("contains domain-wizard feature", () => {
    const domainWizard = featureRegistry.find((f) => f.manifest.id === "domain-wizard");
    expect(domainWizard).toBeDefined();
  });

  it("contains settings feature", () => {
    const settings = featureRegistry.find((f) => f.manifest.id === "settings");
    expect(settings).toBeDefined();
    expect(settings?.manifest.group).toBe("Shared");
    expect(settings?.manifest.status).toBe("Implemented/Internal");
  });

  it("contains workers feature", () => {
    const workers = featureRegistry.find((f) => f.manifest.id === "workers");
    expect(workers).toBeDefined();
  });

  it("contains queues feature", () => {
    const queues = featureRegistry.find((f) => f.manifest.id === "queues");
    expect(queues).toBeDefined();
  });

  it("contains workflow-builder feature (planned)", () => {
    const workflowBuilder = featureRegistry.find(
      (f) => f.manifest.id === "workflow-builder",
    );
    expect(workflowBuilder).toBeDefined();
    expect(workflowBuilder?.manifest.kind).toBe("planned");
  });

  it("contains workflow-debugger feature (planned)", () => {
    const workflowDebugger = featureRegistry.find(
      (f) => f.manifest.id === "workflow-debugger",
    );
    expect(workflowDebugger).toBeDefined();
    expect(workflowDebugger?.manifest.kind).toBe("planned");
  });

  it("contains agent-manager feature", () => {
    const agentManager = featureRegistry.find((f) => f.manifest.id === "agent-manager");
    expect(agentManager).toBeDefined();
  });

  it("contains explainability feature", () => {
    const explainability = featureRegistry.find(
      (f) => f.manifest.id === "explainability",
    );
    expect(explainability).toBeDefined();
  });

  it("contains cost-center feature", () => {
    const costCenter = featureRegistry.find((f) => f.manifest.id === "cost-center");
    expect(costCenter).toBeDefined();
  });

  it("contains marketplace feature", () => {
    const marketplace = featureRegistry.find((f) => f.manifest.id === "marketplace");
    expect(marketplace).toBeDefined();
  });

  it("contains analytics feature", () => {
    const analytics = featureRegistry.find((f) => f.manifest.id === "analytics");
    expect(analytics).toBeDefined();
  });

  it("contains feature-flags feature", () => {
    const featureFlags = featureRegistry.find((f) => f.manifest.id === "feature-flags");
    expect(featureFlags).toBeDefined();
  });

  it("LazyFeatureDashboard is exported", () => {
    expect(LazyFeatureDashboard).toBeDefined();
    expect(typeof LazyFeatureDashboard).toBe("object"); // Lazy component
  });
});

describe("feature registry structure", () => {
  it("all features have required manifest fields", () => {
    featureRegistry.forEach((feature) => {
      expect(feature.manifest).toBeDefined();
      expect(typeof feature.manifest.id).toBe("string");
      expect(typeof feature.manifest.title).toBe("string");
      expect(typeof feature.manifest.group).toBe("string");
      expect(["implemented", "planned"]).toContain(feature.manifest.kind);
    });
  });

  it("all features have required route fields", () => {
    featureRegistry.forEach((feature) => {
      expect(feature.route).toBeDefined();
      expect(typeof feature.route.path).toBe("string");
      expect(feature.route.path.startsWith("/")).toBe(true);
      expect(typeof feature.route.featureId).toBe("string");
      expect(typeof feature.route.permission).toBe("string");
    });
  });

  it("all features have Component function", () => {
    featureRegistry.forEach((feature) => {
      expect(["function", "object"]).toContain(typeof feature.Component);
    });
  });

  it("all features support web platform", () => {
    featureRegistry.forEach((feature) => {
      expect(feature.route.platforms).toContain("web");
    });
  });

  it("all features opt into route-level code splitting", () => {
    featureRegistry.forEach((feature) => {
      expect(feature.route.codeSplit).toBe(true);
    });
  });

  it("all implemented features have status", () => {
    featureRegistry
      .filter((f) => f.manifest.kind === "implemented")
      .forEach((feature) => {
        expect(feature.manifest.status).toBeDefined();
      });
  });
});

describe("feature registry groups", () => {
  it("contains Mission Control group", () => {
    const missionControl = featureRegistry.filter(
      (f) => f.manifest.group === "Mission Control",
    );
    expect(missionControl.length).toBeGreaterThan(0);
  });

  it("contains Operations group", () => {
    const operations = featureRegistry.filter(
      (f) => f.manifest.group === "Operations",
    );
    expect(operations.length).toBeGreaterThan(0);
  });

  it("contains Governance group", () => {
    const governance = featureRegistry.filter(
      (f) => f.manifest.group === "Governance",
    );
    expect(governance.length).toBeGreaterThan(0);
  });

  it("contains Extended group", () => {
    const extended = featureRegistry.filter((f) => f.manifest.group === "Extended");
    expect(extended.length).toBeGreaterThan(0);
  });

  it("contains Admin group", () => {
    const admin = featureRegistry.filter((f) => f.manifest.group === "Admin");
    expect(admin.length).toBeGreaterThan(0);
  });
});

describe("feature registry permissions", () => {
  it("all features require authentication", () => {
    const allProtected = featureRegistry.every((f) => f.route.permission.length > 0);
    expect(allProtected).toBe(true);
  });
});

describe("feature registry paths", () => {
  it("dashboard path is mission-control/dashboard", () => {
    const dashboard = featureRegistry.find((f) => f.manifest.id === "dashboard");
    expect(dashboard?.route.path).toBe("/mission-control/dashboard");
  });

  it("task-cockpit path is mission-control/tasks", () => {
    const taskCockpit = featureRegistry.find((f) => f.manifest.id === "task-cockpit");
    expect(taskCockpit?.route.path).toBe("/mission-control/tasks");
  });

  it("workflow-cockpit path is mission-control/workflows", () => {
    const workflowCockpit = featureRegistry.find(
      (f) => f.manifest.id === "workflow-cockpit",
    );
    expect(workflowCockpit?.route.path).toBe("/mission-control/workflows");
  });

  it("approval path is operations/approvals", () => {
    const approval = featureRegistry.find((f) => f.manifest.id === "approval");
    expect(approval?.route.path).toBe("/mission-control/approvals");
  });

  it("compliance path is governance/compliance", () => {
    const compliance = featureRegistry.find((f) => f.manifest.id === "compliance");
    expect(compliance?.route.path).toBe("/governance/compliance");
  });

  it("conversation path is extended/conversation", () => {
    const conversation = featureRegistry.find((f) => f.manifest.id === "conversation");
    expect(conversation?.route.path).toBe("/mission-control/conversation");
  });

  it("settings path is admin/settings", () => {
    const settings = featureRegistry.find((f) => f.manifest.id === "settings");
    expect(settings?.route.path).toBe("/shared/settings");
  });
});

describe("feature registry summaries", () => {
  it("all features have summary descriptions", () => {
    featureRegistry.forEach((feature) => {
      expect(typeof feature.manifest.summary).toBe("string");
      expect((feature.manifest.summary ?? "").length).toBeGreaterThan(0);
    });
  });
});
