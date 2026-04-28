import { lazy } from "react";
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

// Lazy-loaded features per §4.4.1 (all except / and /login use React.lazy)
const LazyFeatureDashboard = lazy(() => import("@aa/feature-dashboard"));
const LazyFeatureTaskCockpit = lazy(() => import("@aa/feature-task-cockpit"));
const LazyFeatureWorkflowCockpit = lazy(() => import("@aa/feature-workflow-cockpit"));
const LazyFeatureApproval = lazy(() => import("@aa/feature-approval"));
const LazyFeatureStability = lazy(() => import("@aa/feature-stability"));
const LazyFeatureTakeover = lazy(() => import("@aa/feature-takeover"));
const LazyFeatureAlerts = lazy(() => import("@aa/feature-alerts"));
const LazyFeatureDispatch = lazy(() => import("@aa/feature-dispatch"));
const LazyFeatureInspect = lazy(() => import("@aa/feature-inspect"));
const LazyFeatureHealth = lazy(() => import("@aa/feature-health"));
const LazyFeatureIncidents = lazy(() => import("@aa/feature-incidents"));
const LazyFeatureCompliance = lazy(() => import("@aa/feature-compliance"));
const LazyFeaturePolicy = lazy(() => import("@aa/feature-policy"));
const LazyFeatureAudit = lazy(() => import("@aa/feature-audit"));
const LazyFeatureConversation = lazy(() => import("@aa/feature-conversation"));
const LazyFeatureHitl = lazy(() => import("@aa/feature-hitl"));
const LazyFeatureDomainWizard = lazy(() => import("@aa/feature-domain-wizard"));
const LazyFeatureSettings = lazy(() => import("@aa/feature-settings"));
const LazyFeatureWorkers = lazy(() => import("@aa/feature-workers"));
const LazyFeatureQueues = lazy(() => import("@aa/feature-queues"));
const LazyFeatureWorkflowBuilder = lazy(() => import("@aa/feature-workflow-builder"));
const LazyFeatureWorkflowDebugger = lazy(() => import("@aa/feature-workflow-debugger"));
const LazyFeatureAgentManager = lazy(() => import("@aa/feature-agent-manager"));
const LazyFeatureExplainability = lazy(() => import("@aa/feature-explainability"));
const LazyFeatureCostCenter = lazy(() => import("@aa/feature-cost-center"));
const LazyFeatureMarketplace = lazy(() => import("@aa/feature-marketplace"));
const LazyFeatureAnalytics = lazy(() => import("@aa/feature-analytics"));

// Static imports for entry points only (/ and /login per §4.4.1)
const staticFeatures = [dashboard, taskCockpit, workflowCockpit, approval, stability, takeover, alerts, dispatch, inspect, health, incidents, compliance, policy, audit, conversation, hitl, domainWizard, settings, workers, queues, workflowBuilder, workflowDebugger, agentManager, explainability, costCenter, marketplace, analytics] as const;

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
] as const;

export const featureRegistry = staticFeatures;