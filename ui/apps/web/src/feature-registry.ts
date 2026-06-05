import { createElement, lazy } from "react";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import type { FeatureGroup, ImplementationStatus } from "@aa/shared-types";
import { createFeatureModule, type FeatureModule } from "@aa/ui-core";

interface LazyFeatureModuleExports {
  readonly default: FeatureModule;
  readonly [key: string]: unknown;
}

interface LazyFeatureSubPageDescriptor {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly exportName: string;
}

interface LazyFeatureDescriptor {
  readonly id: string;
  readonly group: FeatureGroup;
  readonly path: string;
  readonly status: ImplementationStatus;
  readonly subPages?: readonly LazyFeatureSubPageDescriptor[];
  load(): Promise<LazyFeatureModuleExports>;
}

function createLazyFeatureModule(descriptor: LazyFeatureDescriptor): FeatureModule {
  const featureCopy = translateFeatureCopy(descriptor.id);
  const LazyFeatureView = lazy(async () => descriptor.load().then((module) => ({
    default: module.default.Component,
  })));
  const subPages = descriptor.subPages?.map((subPage) => {
    const LazySubPageView = lazy(async () => descriptor.load().then((module) => {
      const exportedView = module[subPage.exportName];
      if (typeof exportedView !== "function") {
        throw new Error(`Feature sub-page export "${subPage.exportName}" is unavailable for ${descriptor.id}.`);
      }
      return {
        default: exportedView as () => ReturnType<typeof createElement>,
      };
    }));
    return {
      id: subPage.id,
      path: subPage.path,
      label: subPage.label,
      Component: () => createElement(LazySubPageView),
    };
  });

  return {
    ...createFeatureModule({
    id: descriptor.id,
    title: featureCopy.title,
    group: descriptor.group,
    path: descriptor.path,
    permission: "authenticated",
    status: descriptor.status,
    summary: featureCopy.summary,
    render: () => createElement(LazyFeatureView),
    }),
    ...(subPages == null ? {} : { subPages }),
  };
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
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-dispatch"),
  },
  {
    id: "inspect",
    group: "Operations",
    path: "/operations/inspect",
    status: "Implemented/Partial",
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
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-compliance"),
  },
  {
    id: "policy",
    group: "Governance",
    path: "/governance/policy",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-policy"),
  },
  {
    id: "audit",
    group: "Governance",
    path: "/governance/audit",
    status: "Implemented/Partial",
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
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-workflow-builder"),
  },
  {
    id: "workflow-debugger",
    group: "Extended",
    path: "/extended/debugger",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-workflow-debugger"),
  },
  {
    id: "agent-manager",
    group: "Extended",
    path: "/extended/agents",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-agent-manager"),
  },
  {
    id: "explainability",
    group: "Shared",
    path: "/shared/explainability",
    status: "Implemented/Partial",
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
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-governance-compliance"),
  },
  {
    id: "cost-center",
    group: "Shared",
    path: "/shared/costs",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-cost-center"),
  },
  {
    id: "marketplace",
    group: "Shared",
    path: "/shared/marketplace",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-marketplace"),
  },
  {
    id: "analytics",
    group: "Shared",
    path: "/shared/analytics",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-analytics"),
  },
  {
    id: "memory-review",
    group: "Governance",
    path: "/governance/memory-review",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-memory-review"),
  },
  {
    id: "division-inventory",
    group: "Governance",
    path: "/governance/division-inventory",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-division-inventory"),
  },
  {
    id: "release-console",
    group: "Operations",
    path: "/operations/release-console",
    status: "Implemented/Internal",
    subPages: [
      {
        id: "leadership-claims",
        path: "leadership-claims",
        label: translateMessage("ui.releaseConsole.claims.nav"),
        exportName: "LeadershipClaimsWebView",
      },
    ],
    load: async () => import("@aa/feature-release-console"),
  },
  {
    id: "trace-explorer",
    group: "Observability",
    path: "/observability/trace-explorer",
    status: "Implemented/Partial",
    load: async () => import("@aa/feature-trace-explorer"),
  },
];

export const featureRegistry: readonly FeatureModule[] = featureDescriptors.map(createLazyFeatureModule);
