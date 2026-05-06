import type { DomainPresenterPlugin, HumanOutput, MachineOutput, PluginLifecycleContext } from "../../domains/registry/plugin-spi.js";

function stringifyPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

export function createCodingPresenterPlugin(): DomainPresenterPlugin {
  return {
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    spiType: "presenter",
    capabilityIds: ["present.output", "present.diff", "present.summary"],
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
    async formatOutput(input): Promise<HumanOutput> {
      const completedSteps = input.machineOutputs.map((output) => output.stepId);
      const sections = input.machineOutputs.map((output) => [
        `### ${output.stepId}`,
        output.outputRef ? `outputRef: ${output.outputRef}` : "outputRef: inline",
        "```json",
        stringifyPayload(output.payload),
        "```",
      ].join("\n"));
      if (input.artifacts.length > 0) {
        sections.push([
          "### Artifacts",
          ...input.artifacts.map((artifactRef) => `- ${artifactRef}`),
        ].join("\n"));
      }
      return {
        summary: completedSteps.length > 0
          ? `Completed ${completedSteps.length} coding step(s): ${completedSteps.join(", ")}`
          : "No coding output produced",
        sections,
        citations: input.artifacts.map((artifactRef) => artifactRef),
      };
    },
  };
}
