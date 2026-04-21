export function createBasicEvaluatorPlugin() {
    return {
        pluginId: "plugin.core.basic-evaluator",
        domainId: "core",
        spiType: "validator",
        capabilityIds: ["output.validate"],
        async initialize() {
            return undefined;
        },
        async healthCheck() {
            return true;
        },
        async shutdown() {
            return undefined;
        },
        async validate(input) {
            const payload = input.machineOutput.payload ?? {};
            const contract = input.contract ?? {};
            const errors = [];
            const suggestions = [];
            for (const field of contract.requiredFields ?? []) {
                if (!(field in payload)) {
                    errors.push({
                        field,
                        message: `Missing required field "${field}"`,
                        severity: "error",
                    });
                    suggestions.push(`Provide "${field}" in machine output payload.`);
                }
            }
            for (const [field, expectedType] of Object.entries(contract.fieldTypes ?? {})) {
                if (!(field in payload)) {
                    continue;
                }
                const value = payload[field];
                const actualType = Array.isArray(value) ? "array" : value === null ? "object" : typeof value;
                if (actualType !== expectedType) {
                    errors.push({
                        field,
                        message: `Expected ${expectedType}, received ${actualType}`,
                        severity: "error",
                    });
                    suggestions.push(`Normalize "${field}" to ${expectedType}.`);
                }
            }
            return {
                valid: errors.length === 0,
                errors,
                suggestions,
            };
        },
    };
}
//# sourceMappingURL=basic-evaluator.js.map