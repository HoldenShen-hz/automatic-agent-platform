/**
 * Growth domain presenter plugin.
 *
 * Formats growth output — campaign summaries, A/B test results, customer analytics —
 * into human-readable form for marketers, analysts, and growth engineers.
 *
 * §G8: Growth domain — formats for "end_user" and "reviewer" audiences.
 */
function formatCampaign(output) {
    const name = output.payload["campaignName"] ?? output.stepId;
    const reach = output.payload["reach"] ?? "unknown";
    const conversion = output.payload["conversionRate"] ?? "unknown";
    const roas = output.payload["roas"] ?? "unknown";
    return [
        `## Campaign: ${name}`,
        "",
        `- **Reach**: ${reach}`,
        `- **Conversion Rate**: ${conversion}`,
        `- **ROAS**: ${roas}`,
    ].join("\n");
}
function formatABTest(output) {
    const testName = output.payload["testName"] ?? output.stepId;
    const variant = output.payload["variant"] ?? "control";
    const lift = output.payload["lift"] ?? "unknown";
    const confidence = output.payload["confidence"] ?? "unknown";
    return [
        `## A/B Test: ${testName}`,
        "",
        `- **Winning Variant**: ${variant}`,
        `- **Lift**: ${lift}`,
        `- **Confidence**: ${confidence}`,
    ].join("\n");
}
export function createGrowthPresenterPlugin() {
    return {
        pluginId: "plugin.growth.presenter",
        domainId: "growth",
        spiType: "presenter",
        capabilityIds: ["present.output", "present.campaign", "present.abtest"],
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
                if (type === "campaign") {
                    sections.push(formatCampaign(output));
                    citations.push(output.outputRef ?? output.stepId);
                }
                else if (type === "abtest") {
                    sections.push(formatABTest(output));
                    citations.push(output.outputRef ?? output.stepId);
                }
                else {
                    sections.push(`### ${output.stepId}\n\n\`\`\`json\n${JSON.stringify(output.payload, null, 2)}\n\`\`\``);
                    citations.push(output.outputRef ?? output.stepId);
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
//# sourceMappingURL=growth-presenter.js.map