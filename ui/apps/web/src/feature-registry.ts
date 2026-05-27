import dashboard from "@aa/feature-dashboard";
import missionConsole from "@aa/feature-mission-console";
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
import workflowDebuggerFeature from "@aa/feature-workflow-debugger";
import agentManager from "@aa/feature-agent-manager";
import explainability from "@aa/feature-explainability";
import governanceCompliance from "@aa/feature-governance-compliance";
import costCenter from "@aa/feature-cost-center";
import marketplace from "@aa/feature-marketplace";
import analytics from "@aa/feature-analytics";
import featureFlags from "@aa/feature-feature-flags";
import memoryReview from "@aa/feature-memory-review";
import releaseConsole from "@aa/feature-release-console";
import traceExplorer from "@aa/feature-trace-explorer";
import type { FeatureModule } from "@aa/ui-core";

export const featureRegistry: readonly FeatureModule[] = [
  dashboard,
  missionConsole,
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
  workflowDebuggerFeature,
  agentManager,
  explainability,
  featureFlags,
  governanceCompliance,
  costCenter,
  marketplace,
  analytics,
  memoryReview,
  releaseConsole,
  traceExplorer,
];
