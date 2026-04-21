function stringifyPayload(payload) {
    return JSON.stringify(payload, null, 2);
}
export function createCodingPresenterPlugin() {
    return {
        pluginId: "plugin.coding.presenter",
        domainId: "coding",
        spiType: "presenter",
        capabilityIds: ["present.output", "present.diff", "present.summary"],
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
                    ? `完成 ${completedSteps.length} 个 coding 步骤：${completedSteps.join(", ")}`
                    : "未产生 coding 输出",
                sections,
                citations: input.artifacts.map((artifactRef) => artifactRef),
            };
        },
    };
}
//# sourceMappingURL=coding-presenter.js.map