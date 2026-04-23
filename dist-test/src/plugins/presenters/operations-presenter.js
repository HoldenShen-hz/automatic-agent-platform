/**
 * Operations domain presenter plugin.
 *
 * Formats operational output — runbooks, incident summaries, monitoring alerts —
 * into human-readable form for operators and SREs.
 *
 * §G8: Operations domain — formats for "operator" and "reviewer" audiences.
 */
function formatIncident(output) {
    const severity = output.payload["severity"] ?? "unknown";
    const system = output.payload["system"] ?? "unknown";
    const description = output.payload["description"] ?? "No description provided.";
    return `## [${severity.toUpperCase()}] ${system}\n\n${description}`;
}
function formatRunbook(output) {
    const title = output.payload["title"] ?? output.stepId;
    const steps = output.payload["steps"] ?? [];
    return [
        `## ${title}`,
        "",
        ...steps.map((step, i) => `${i + 1}. ${step}`),
    ].join("\n");
}
export function createOperationsPresenterPlugin() {
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
        async formatOutput(input) {
            const sections = [];
            const citations = [];
            for (const output of input.machineOutputs) {
                const type = output.payload["type"] ?? "generic";
                if (type === "incident") {
                    sections.push(formatIncident(output));
                    citations.push(output.outputRef ?? output.stepId);
                }
                else if (type === "runbook") {
                    sections.push(formatRunbook(output));
                    citations.push(output.outputRef ?? output.stepId);
                }
                else {
                    sections.push(`### ${output.stepId}\n\n\`\`\`json\n${JSON.stringify(output.payload, null, 2)}\n\`\`\``);
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
//# sourceMappingURL=operations-presenter.js.map