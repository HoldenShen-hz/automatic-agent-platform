/**
 * Growth domain presenter plugin.
 *
 * Formats growth output — campaign summaries, A/B test results, customer analytics —
 * into human-readable form for marketers, analysts, and growth engineers.
 *
 * §G8: Growth domain — formats for "end_user" and "reviewer" audiences.
 */

import type { DomainPresenterPlugin, HumanOutput, MachineOutput, PluginLifecycleContext } from "../../domains/registry/plugin-spi.js";

function resolveMachineOutputStepId(output: MachineOutput): string {
  return output.nodeId ?? output.stepId ?? "unknown_step";
}

function resolveCitation(output: MachineOutput): string {
  return output.outputRef ?? resolveMachineOutputStepId(output);
}

function formatCampaign(output: MachineOutput): string {
  const stepId = resolveMachineOutputStepId(output);
  const name = output.payload["campaignName"] as string ?? stepId;
  const reach = output.payload["reach"] as string ?? "unknown";
  const conversion = output.payload["conversionRate"] as string ?? "unknown";
  const roas = output.payload["roas"] as string ?? "unknown";
  return [
    `## Campaign: ${name}`,
    "",
    `- **Reach**: ${reach}`,
    `- **Conversion Rate**: ${conversion}`,
    `- **ROAS**: ${roas}`,
  ].join("\n");
}

function formatABTest(output: MachineOutput): string {
  const stepId = resolveMachineOutputStepId(output);
  const testName = output.payload["testName"] as string ?? stepId;
  const variant = output.payload["variant"] as string ?? "control";
  const lift = output.payload["lift"] as string ?? "unknown";
  const confidence = output.payload["confidence"] as string ?? "unknown";
  return [
    `## A/B Test: ${testName}`,
    "",
    `- **Winning Variant**: ${variant}`,
    `- **Lift**: ${lift}`,
    `- **Confidence**: ${confidence}`,
  ].join("\n");
}

export function createGrowthPresenterPlugin(): DomainPresenterPlugin {
  return {
    pluginId: "plugin.growth.presenter",
    domainId: "growth",
    spiType: "presenter",
    capabilityIds: ["present.output", "present.campaign", "present.abtest"],
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
      const sections: string[] = [];
      const citations: string[] = [];

      for (const output of input.machineOutputs) {
        const type = output.payload["type"] as string ?? "generic";
        if (type === "campaign") {
          sections.push(formatCampaign(output));
          citations.push(resolveCitation(output));
        } else if (type === "abtest") {
          sections.push(formatABTest(output));
          citations.push(resolveCitation(output));
        } else {
          const stepId = resolveMachineOutputStepId(output);
          sections.push(
            `### ${stepId}\n\n\`\`\`json\n${JSON.stringify(output.payload, null, 2)}\n\`\`\``
          );
          citations.push(resolveCitation(output));
        }
      }

      if (input.artifacts.length > 0) {
        sections.push([
          "### Artifacts",
          ...input.artifacts.map((artifactRef) => `- ${artifactRef}`),
        ].join("\n"));
      }

      const stepCount = input.machineOutputs.length;
      return {
        summary: stepCount > 0
          ? `Growth: ${stepCount} step${stepCount === 1 ? "" : "s"} processed`
          : "No growth output produced",
        sections,
        citations,
      };
    },
  };
}
