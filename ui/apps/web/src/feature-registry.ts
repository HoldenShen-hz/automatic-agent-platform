import { createElement, lazy } from "react";
import { translateFeatureCopy } from "@aa/shared-i18n";
import type { FeatureGroup, ImplementationStatus } from "@aa/shared-types";
import { createFeatureModule, type FeatureModule } from "@aa/ui-core";

interface LazyFeatureDescriptor {
  readonly id: string;
  readonly group: FeatureGroup;
  readonly path: string;
  readonly status: ImplementationStatus;
  load(): Promise<{ default: FeatureModule }>;
}

function createLazyFeatureModule(descriptor: LazyFeatureDescriptor): FeatureModule {
  const featureCopy = translateFeatureCopy(descriptor.id);
  const LazyFeatureView = lazy(async () => descriptor.load().then((module) => ({
    default: module.default.Component,
  })));

  return createFeatureModule({
    id: descriptor.id,
    title: featureCopy.title,
    group: descriptor.group,
    path: descriptor.path,
    permission: "authenticated",
    status: descriptor.status,
    summary: featureCopy.summary,
    render: () => createElement(LazyFeatureView),
  });
}

const featureDescriptors: readonly LazyFeatureDescriptor[] = [
  {
    id: "dashboard",
    group: "Mission Control",
    path: "/mission-control/dashboard",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-dashboard"),
  },
  {
    id: "mission-console",
    group: "Mission Control",
    path: "/mission-control/missions",
    status: "Implemented/Contracted",
    load: async () => import("@aa/feature-mission-console"),
  },
  {
    id: "task-cockpit",
    group: "Mission Control",
    path: "/mission-control/tasks",
    status: "Implemented/Contracted",
    load: async () => import("@aa/feature-task-cockpit"),
  },
  {
    id: "workflow-cockpit",
    group: "Mission Control",
    path: "/mission-control/workflows",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-workflow-cockpit"),
  },
  {
    id: "approval",
    group: "Mission Control",
    path: "/mission-control/approvals",
    status: "Implemented/Contracted",
    load: async () => import("@aa/feature-approval"),
  },
  {
    id: "stability",
    group: "Mission Control",
    path: "/mission-control/stability",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-stability"),
  },
  {
    id: "takeover",
    group: "Admin",
    path: "/admin/takeover",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-takeover"),
  },
  {
    id: "alerts",
    group: "Mission Control",
    path: "/mission-control/alerts",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-alerts"),
  },
  {
    id: "dispatch",
    group: "Operations",
    path: "/operations/dispatch",
    status: "Planned",
    load: async () => import("@aa/feature-dispatch"),
  },
  {
    id: "inspect",
    group: "Operations",
    path: "/operations/inspect",
    status: "Planned",
    load: async () => import("@aa/feature-inspect"),
  },
  {
    id: "health",
    group: "Operations",
    path: "/operations/health",
    status: "Implemented/Contracted",
    load: async () => import("@aa/feature-health"),
  },
  {
    id: "incidents",
    group: "Operations",
    path: "/operations/incidents",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-incidents"),
  },
  {
    id: "compliance",
    group: "Governance",
    path: "/governance/compliance",
    status: "Planned",
    load: async () => import("@aa/feature-compliance"),
  },
  {
    id: "policy",
    group: "Governance",
    path: "/governance/policy",
    status: "Planned",
    load: async () => import("@aa/feature-policy"),
  },
  {
    id: "audit",
    group: "Governance",
    path: "/governance/audit",
    status: "Planned",
    load: async () => import("@aa/feature-audit"),
  },
  {
    id: "conversation",
    group: "Mission Control",
    path: "/mission-control/conversation",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-conversation"),
  },
  {
    id: "hitl",
    group: "Extended",
    path: "/extended/hitl",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-hitl"),
  },
  {
    id: "domain-wizard",
    group: "Shared",
    path: "/shared/domain-wizard",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-domain-wizard"),
  },
  {
    id: "settings",
    group: "Shared",
    path: "/shared/settings",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-settings"),
  },
  {
    id: "workers",
    group: "Admin",
    path: "/admin/workers",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-workers"),
  },
  {
    id: "queues",
    group: "Admin",
    path: "/admin/queues",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-queues"),
  },
  {
    id: "workflow-builder",
    group: "Extended",
    path: "/extended/workflow-builder",
    status: "Planned",
    load: async () => import("@aa/feature-workflow-builder"),
  },
  {
    id: "workflow-debugger",
    group: "Extended",
    path: "/extended/debugger",
    status: "Planned",
    load: async () => import("@aa/feature-workflow-debugger"),
  },
  {
    id: "agent-manager",
    group: "Extended",
    path: "/extended/agents",
    status: "Planned",
    load: async () => import("@aa/feature-agent-manager"),
  },
  {
    id: "explainability",
    group: "Shared",
    path: "/shared/explainability",
    status: "Planned",
    load: async () => import("@aa/feature-explainability"),
  },
  {
    id: "feature-flags",
    group: "Admin",
    path: "/admin/feature-flags",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-feature-flags"),
  },
  {
    id: "governance-compliance",
    group: "Governance",
    path: "/governance/governance-overview",
    status: "Planned",
    load: async () => import("@aa/feature-governance-compliance"),
  },
  {
    id: "cost-center",
    group: "Shared",
    path: "/shared/costs",
    status: "Planned",
    load: async () => import("@aa/feature-cost-center"),
  },
  {
    id: "marketplace",
    group: "Shared",
    path: "/shared/marketplace",
    status: "Planned",
    load: async () => import("@aa/feature-marketplace"),
  },
  {
    id: "analytics",
    group: "Shared",
    path: "/shared/analytics",
    status: "Planned",
    load: async () => import("@aa/feature-analytics"),
  },
  {
    id: "memory-review",
    group: "Governance",
    path: "/governance/memory-review",
    status: "Planned",
    load: async () => import("@aa/feature-memory-review"),
  },
  {
    id: "release-console",
    group: "Operations",
    path: "/operations/release-console",
    status: "Implemented/Internal",
    load: async () => import("@aa/feature-release-console"),
  },
  {
    id: "trace-explorer",
    group: "Observability",
    path: "/observability/trace-explorer",
    status: "Planned",
    load: async () => import("@aa/feature-trace-explorer"),
  },
];

export const featureRegistry: readonly FeatureModule[] = featureDescriptors.map(createLazyFeatureModule);
