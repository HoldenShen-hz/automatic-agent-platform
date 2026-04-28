import { lazy } from "react";

// All features use React.lazy per §4.4.1 (only / and /login are static entry points)
// Lazy-loaded feature registry for code splitting per §7.3.1
export const LazyFeatureDashboard = lazy(() => import("@aa/feature-dashboard"));
export const LazyFeatureTaskCockpit = lazy(() => import("@aa/feature-task-cockpit"));
export const LazyFeatureWorkflowCockpit = lazy(() => import("@aa/feature-workflow-cockpit"));
export const LazyFeatureApproval = lazy(() => import("@aa/feature-approval"));
export const LazyFeatureStability = lazy(() => import("@aa/feature-stability"));
export const LazyFeatureTakeover = lazy(() => import("@aa/feature-takeover"));
export const LazyFeatureAlerts = lazy(() => import("@aa/feature-alerts"));
export const LazyFeatureDispatch = lazy(() => import("@aa/feature-dispatch"));
export const LazyFeatureInspect = lazy(() => import("@aa/feature-inspect"));
export const LazyFeatureHealth = lazy(() => import("@aa/feature-health"));
export const LazyFeatureIncidents = lazy(() => import("@aa/feature-incidents"));
export const LazyFeatureCompliance = lazy(() => import("@aa/feature-compliance"));
export const LazyFeaturePolicy = lazy(() => import("@aa/feature-policy"));
export const LazyFeatureAudit = lazy(() => import("@aa/feature-audit"));
export const LazyFeatureConversation = lazy(() => import("@aa/feature-conversation"));
export const LazyFeatureHitl = lazy(() => import("@aa/feature-hitl"));
export const LazyFeatureDomainWizard = lazy(() => import("@aa/feature-domain-wizard"));
export const LazyFeatureSettings = lazy(() => import("@aa/feature-settings"));
export const LazyFeatureWorkers = lazy(() => import("@aa/feature-workers"));
export const LazyFeatureQueues = lazy(() => import("@aa/feature-queues"));
export const LazyFeatureWorkflowBuilder = lazy(() => import("@aa/feature-workflow-builder"));
export const LazyFeatureWorkflowDebugger = lazy(() => import("@aa/feature-workflow-debugger"));
export const LazyFeatureAgentManager = lazy(() => import("@aa/feature-agent-manager"));
export const LazyFeatureExplainability = lazy(() => import("@aa/feature-explainability"));
export const LazyFeatureCostCenter = lazy(() => import("@aa/feature-cost-center"));
export const LazyFeatureMarketplace = lazy(() => import("@aa/feature-marketplace"));
export const LazyFeatureAnalytics = lazy(() => import("@aa/feature-analytics"));
export const LazyFeatureFeatureFlags = lazy(() => import("@aa/feature-feature-flags"));

// Static imports only for entry points (/ and /login) per §4.4.1
import dashboard from "@aa/feature-dashboard";
import taskCockpit from "@aa/feature-task-cockpit";
import workflowCockpit from "@aa/feature-workflow-cockpit";
import approval from "@aa/feature-approval";
import stability from "@aa/feature-stability";
import takeover from "@aa/feature-takeover";
import alerts from "@aa/feature-alerts";
import dispatch from "@aa/feature-dispatch";
import inspect from "@aa/feature-inspect";
import health from "@aa/feature-health";
import incidents from "@aa/feature-incidents";
import compliance from "@aa/feature-compliance";
import policy from "@aa/feature-policy";
import audit from "@aa/feature-audit";
import conversation from "@aa/feature-conversation";
import hitl from "@aa/feature-hitl";
import domainWizard from "@aa/feature-domain-wizard";
import settings from "@aa/feature-settings";
import workers from "@aa/feature-workers";
import queues from "@aa/feature-queues";
import workflowBuilder from "@aa/feature-workflow-builder";
import workflowDebugger from "@aa/feature-workflow-debugger";
import agentManager from "@aa/feature-agent-manager";
import explainability from "@aa/feature-explainability";
import costCenter from "@aa/feature-cost-center";
import marketplace from "@aa/feature-marketplace";
import analytics from "@aa/feature-analytics";
import featureFlags from "@aa/feature-feature-flags";

// Static entry points only (per §4.4.1: only / and /login are non-lazy)
const staticFeatures = [dashboard, taskCockpit, workflowCockpit, approval, stability, takeover, alerts, dispatch, inspect, health, incidents, compliance, policy, audit, conversation, hitl, domainWizard, settings, workers, queues, workflowBuilder, workflowDebugger, agentManager, explainability, costCenter, marketplace, analytics, featureFlags] as const;

// Lazy-loaded feature registry for code splitting
export const lazyFeatureRegistry = [
  { manifest: dashboard.manifest, route: dashboard.route, Component: LazyFeatureDashboard },
  { manifest: taskCockpit.manifest, route: taskCockpit.route, Component: LazyFeatureTaskCockpit },
  { manifest: workflowCockpit.manifest, route: workflowCockpit.route, Component: LazyFeatureWorkflowCockpit },
  { manifest: approval.manifest, route: approval.route, Component: LazyFeatureApproval },
  { manifest: stability.manifest, route: stability.route, Component: LazyFeatureStability },
  { manifest: takeover.manifest, route: takeover.route, Component: LazyFeatureTakeover },
  { manifest: alerts.manifest, route: alerts.route, Component: LazyFeatureAlerts },
  { manifest: dispatch.manifest, route: dispatch.route, Component: LazyFeatureDispatch },
  { manifest: inspect.manifest, route: inspect.route, Component: LazyFeatureInspect },
  { manifest: health.manifest, route: health.route, Component: LazyFeatureHealth },
  { manifest: incidents.manifest, route: incidents.route, Component: LazyFeatureIncidents },
  { manifest: compliance.manifest, route: compliance.route, Component: LazyFeatureCompliance },
  { manifest: policy.manifest, route: policy.route, Component: LazyFeaturePolicy },
  { manifest: audit.manifest, route: audit.route, Component: LazyFeatureAudit },
  { manifest: conversation.manifest, route: conversation.route, Component: LazyFeatureConversation },
  { manifest: hitl.manifest, route: hitl.route, Component: LazyFeatureHitl },
  { manifest: domainWizard.manifest, route: domainWizard.route, Component: LazyFeatureDomainWizard },
  { manifest: settings.manifest, route: settings.route, Component: LazyFeatureSettings },
  { manifest: workers.manifest, route: workers.route, Component: LazyFeatureWorkers },
  { manifest: queues.manifest, route: queues.route, Component: LazyFeatureQueues },
  { manifest: workflowBuilder.manifest, route: workflowBuilder.route, Component: LazyFeatureWorkflowBuilder },
  { manifest: workflowDebugger.manifest, route: workflowDebugger.route, Component: LazyFeatureWorkflowDebugger },
  { manifest: agentManager.manifest, route: agentManager.route, Component: LazyFeatureAgentManager },
  { manifest: explainability.manifest, route: explainability.route, Component: LazyFeatureExplainability },
  { manifest: costCenter.manifest, route: costCenter.route, Component: LazyFeatureCostCenter },
  { manifest: marketplace.manifest, route: marketplace.route, Component: LazyFeatureMarketplace },
  { manifest: analytics.manifest, route: analytics.route, Component: LazyFeatureAnalytics },
  { manifest: featureFlags.manifest, route: featureFlags.route, Component: LazyFeatureFeatureFlags },
] as const;

export const featureRegistry = staticFeatures;