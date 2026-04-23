export class DomainSmokeTestRunner {
    run(definition) {
        const issues = [];
        const runtimeChecks = [];
        if (definition.workflows.length === 0) {
            issues.push("domain_registry.no_workflows");
        }
        if (definition.toolBundles.length === 0) {
            issues.push("domain_registry.no_tool_bundles");
        }
        if (definition.capabilities.requiredTools.some((tool) => !definition.toolBundles.some((bundle) => bundle.tools.some((entry) => entry.toolName === tool)))) {
            issues.push("domain_registry.missing_required_tools");
        }
        // Gate check 1: Dependency resolution validation
        runtimeChecks.push(this.validateDependencyGraph(definition));
        // Gate check 2: Sandbox compatibility test
        runtimeChecks.push(this.validateSandboxCompatibility(definition.capabilities));
        // Gate check 3: Resource quota pre-check
        runtimeChecks.push(this.validateResourceQuotas(definition.capabilities));
        if (runtimeChecks.some((check) => !check.passed)) {
            issues.push("domain_registry.runtime_checks_failed");
        }
        return {
            passed: issues.length === 0,
            issues,
            runtimeChecks,
            rollbackPoints: this.computeRollbackPoints(definition),
        };
    }
    validateDependencyGraph(definition) {
        const stepIds = new Set();
        const dependsOnMap = new Map();
        for (const workflow of definition.workflows) {
            for (const step of workflow.steps) {
                stepIds.add(step.stepName);
                dependsOnMap.set(step.stepName, step.dependsOn);
            }
        }
        const visited = new Set();
        const visiting = new Set();
        let hasCycle = false;
        const dfs = (stepName) => {
            if (visiting.has(stepName)) {
                hasCycle = true;
                return;
            }
            if (visited.has(stepName)) {
                return;
            }
            visiting.add(stepName);
            for (const dep of dependsOnMap.get(stepName) ?? []) {
                if (!stepIds.has(dep)) {
                    continue;
                }
                dfs(dep);
            }
            visiting.delete(stepName);
            visited.add(stepName);
        };
        for (const stepId of stepIds) {
            dfs(stepId);
        }
        return {
            checkId: "dependency_graph",
            passed: !hasCycle,
            details: hasCycle
                ? "Circular dependency detected in workflow steps"
                : `Validated ${stepIds.size} steps across ${definition.workflows.length} workflows`,
        };
    }
    validateSandboxCompatibility(capabilities) {
        const restrictedTools = ["file_write", "bash", "exec", "sql_execute"];
        const hasRestricted = capabilities.requiredTools.some((tool) => restrictedTools.includes(tool));
        if (hasRestricted && capabilities.securityLevel !== "restricted") {
            return {
                checkId: "sandbox_compatibility",
                passed: false,
                details: "Restricted tools require securityLevel=restricted for sandbox compatibility",
            };
        }
        return {
            checkId: "sandbox_compatibility",
            passed: true,
            details: "Sandbox compatibility verified",
        };
    }
    validateResourceQuotas(capabilities) {
        const { budgetLimits } = capabilities;
        if (budgetLimits.maxTokensPerTask < 1000) {
            return {
                checkId: "resource_quota",
                passed: false,
                details: `maxTokensPerTask=${budgetLimits.maxTokensPerTask} is below minimum required 1000`,
            };
        }
        if (budgetLimits.maxCostPerTask < 0.01) {
            return {
                checkId: "resource_quota",
                passed: false,
                details: `maxCostPerTask=${budgetLimits.maxCostPerTask} is below minimum required 0.01`,
            };
        }
        return {
            checkId: "resource_quota",
            passed: true,
            details: `Resource quotas validated: maxTokens=${budgetLimits.maxTokensPerTask}, maxCost=$${budgetLimits.maxCostPerTask}`,
        };
    }
    computeRollbackPoints(definition) {
        const points = [];
        for (const workflow of definition.workflows) {
            for (const step of workflow.steps) {
                if (step.dependsOn.length > 0) {
                    points.push(`workflow:${workflow.workflowId}/step:${step.stepName}`);
                }
            }
        }
        return points;
    }
}
//# sourceMappingURL=domain-smoke-test.js.map