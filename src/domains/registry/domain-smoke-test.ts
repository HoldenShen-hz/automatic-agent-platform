import type { DomainDefinition } from "./domain-model.js";

export interface DomainSmokeTestResult {
  passed: boolean;
  issues: string[];
}

export class DomainSmokeTestRunner {
  public run(definition: DomainDefinition): DomainSmokeTestResult {
    const issues: string[] = [];
    if (definition.workflows.length === 0) {
      issues.push("domain_registry.no_workflows");
    }
    if (definition.toolBundles.length === 0) {
      issues.push("domain_registry.no_tool_bundles");
    }
    if (definition.capabilities.requiredTools.some((tool) => !definition.toolBundles.some((bundle) => bundle.tools.some((entry) => entry.toolName === tool)))) {
      issues.push("domain_registry.missing_required_tools");
    }
    return {
      passed: issues.length === 0,
      issues,
    };
  }
}
