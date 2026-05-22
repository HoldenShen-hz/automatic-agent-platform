import type { DomainPresenterPlugin, HumanOutput } from "../../domains/registry/plugin-spi.js";

function stringifyPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

export function createCodingPresenterPlugin(): DomainPresenterPlugin {
  let initialized = false;
  return {
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    spiType: "presenter",
    capabilityIds: ["present.output", "present.diff", "present.summary"],
    async initialize() {
      initialized = true;
      return undefined;
    },
    async healthCheck() {
      return initialized;
    },
    async shutdown() {
      initialized = false;
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
