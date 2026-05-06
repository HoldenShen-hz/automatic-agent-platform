import type { DomainPlannerPlugin, PluginLifecycleContext } from "../../domains/registry/plugin-spi.js";

export function createBasicPlannerPlugin(): DomainPlannerPlugin {
  return {
    pluginId: "plugin.core.basic-planner",
    domainId: "core",
    spiType: "planner",
    capabilityIds: ["workflow.suggest"],
    async onLoad(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being loaded
    },
    async onActivate(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being activated
    },
    async onDeactivate(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being deactivated
    },
    async onUnload(_context: PluginLifecycleContext): Promise<void> {
      // Plugin is being unloaded
    },
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      return undefined;
    },
    async suggestWorkflow(task) {
      if (task.assessment.complexity === "critical") {
        return null;
      }

      const requiresReview = task.assessment.approvalPolicy.required || task.assessment.risk === "high";
      const overrides =
        task.assessment.complexity === "trivial" || task.assessment.complexity === "simple"
          ? [
              {
                stepName: "direct-execute",
                toolHints: ["read", "write"],
                timeoutMs: 30_000,
              },
            ]
          : task.assessment.complexity === "moderate"
            ? [
                {
                  stepName: "plan",
                  toolHints: ["read"],
                  timeoutMs: 45_000,
                },
                {
                  stepName: "execute",
                  toolHints: ["write", "apply_patch"],
                  retryPolicy: { maxRetries: 1, backoffMs: 500 },
                  timeoutMs: 60_000,
                },
                {
                  stepName: "review",
                  toolHints: ["read"],
                  requiresReview,
                  timeoutMs: 30_000,
                },
              ]
            : [
                {
                  stepName: "plan",
                  toolHints: ["read"],
                  timeoutMs: 60_000,
                },
                {
                  stepName: "approve",
                  toolHints: [],
                  requiresReview: true,
                  timeoutMs: 30_000,
                },
                {
                  stepName: "execute",
                  toolHints: ["apply_patch", "write"],
                  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
                  timeoutMs: 90_000,
                },
                {
                  stepName: "validate",
                  toolHints: ["read"],
                  requiresReview: true,
                  timeoutMs: 45_000,
                },
              ];

      return {
        workflowId: `workflow.core.${task.assessment.complexity}`,
        overrides,
        rationale: `assessment=${task.assessment.complexity};risk=${task.assessment.risk};approvalRequired=${String(task.assessment.approvalPolicy.required)}`,
      };
    },
  };
}
