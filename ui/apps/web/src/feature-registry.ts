import { lazy } from "react";

// Eager-loaded: root (/) and login are required for initial render
import dashboard from "@aa/feature-dashboard";

// All other features use React.lazy for code splitting per §4.4.1
const taskCockpit = lazy(() => import("@aa/feature-task-cockpit"));
const workflowCockpit = lazy(() => import("@aa/feature-workflow-cockpit"));
const approval = lazy(() => import("@aa/feature-approval"));
const stability = lazy(() => import("@aa/feature-stability"));
const takeover = lazy(() => import("@aa/feature-takeover"));
const alerts = lazy(() => import("@aa/feature-alerts"));
const dispatch = lazy(() => import("@aa/feature-dispatch"));
const inspect = lazy(() => import("@aa/feature-inspect"));
const health = lazy(() => import("@aa/feature-health"));
const incidents = lazy(() => import("@aa/feature-incidents"));
const compliance = lazy(() => import("@aa/feature-compliance"));
const policy = lazy(() => import("@aa/feature-policy"));
const audit = lazy(() => import("@aa/feature-audit"));
const conversation = lazy(() => import("@aa/feature-conversation"));
const hitl = lazy(() => import("@aa/feature-hitl"));
const domainWizard = lazy(() => import("@aa/feature-domain-wizard"));
const settings = lazy(() => import("@aa/feature-settings"));
const workers = lazy(() => import("@aa/feature-workers"));
const queues = lazy(() => import("@aa/feature-queues"));
const workflowBuilder = lazy(() => import("@aa/feature-workflow-builder"));
const workflowDebugger = lazy(() => import("@aa/feature-workflow-debugger"));
const agentManager = lazy(() => import("@aa/feature-agent-manager"));
const explainability = lazy(() => import("@aa/feature-explainability"));
const costCenter = lazy(() => import("@aa/feature-cost-center"));
const marketplace = lazy(() => import("@aa/feature-marketplace"));
const analytics = lazy(() => import("@aa/feature-analytics"));

export const missionControlFeatureContracts = [
  { id: "alerts", path: "/mission-control/alerts", permission: "platform_sre" },
  { id: "conversation", group: "Mission Control", path: "/mission-control/conversation" },
] as const;

export const featureRegistry = [
  dashboard,
  taskCockpit,
  workflowCockpit,
  approval,
  stability,
  takeover,
  alerts,
  dispatch,
  inspect,
  health,
  incidents,
  compliance,
  policy,
  audit,
  conversation,
  hitl,
  domainWizard,
  settings,
  workers,
  queues,
  workflowBuilder,
  workflowDebugger,
  agentManager,
  explainability,
  costCenter,
  marketplace,
  analytics,
] as const;
