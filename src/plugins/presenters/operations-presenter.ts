/**
 * Operations domain presenter plugin.
 *
 * Formats operational output — runbooks, incident summaries, monitoring alerts —
 * into human-readable form for operators and SREs.
 *
 * §G8: Operations domain — formats for "operator" and "reviewer" audiences.
 */

import type { DomainPresenterPlugin, HumanOutput, MachineOutput } from "../../domains/registry/plugin-spi.js";

function formatIncident(output: MachineOutput): string {
  const severity = output.payload["severity"] as string ?? "unknown";
  const system = output.payload["system"] as string ?? "unknown";
  const description = output.payload["description"] as string ?? "No description provided.";
  return `## [${severity.toUpperCase()}] ${system}\n\n${description}`;
}

function formatRunbook(output: MachineOutput): string {
  const title = output.payload["title"] as string ?? output.stepId ?? output.nodeId ?? "unknown";
  const steps = (output.payload["steps"] as string[]) ?? [];
  return [
    `## ${title}`,
    "",
    ...steps.map((step, i) => `${i + 1}. ${step.replace(/^Step\s+\d+\s*:\s*/i, "")}`),
  ].join("\n");
}

export function createOperationsPresenterPlugin(): DomainPresenterPlugin {
  return {
    pluginId: "plugin.operations.presenter",
    domainId: "operations",
    spiType: "presenter",
    capabilityIds: ["present.output", "present.incident", "present.runbook"],
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
        if (type === "incident") {
          sections.push(formatIncident(output));
          citations.push(output.outputRef ?? output.stepId ?? output.nodeId ?? "unknown");
        } else if (type === "runbook") {
          sections.push(formatRunbook(output));
          citations.push(output.outputRef ?? output.stepId ?? output.nodeId ?? "unknown");
        } else {
          sections.push(
            `### ${output.stepId ?? output.nodeId ?? "unknown"}\n\n\`\`\`json\n${JSON.stringify(output.payload, null, 2)}\n\`\`\``
          );
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
          ? `Operations: ${stepCount} step${stepCount === 1 ? "" : "s"} processed`
          : "No operational output produced",
        sections,
        citations,
      };
    },
  };
}
