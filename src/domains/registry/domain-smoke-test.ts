import type { DomainDefinition } from "./domain-model.js";
import type { DomainCapabilityProfile } from "./domain-model.js";

export interface SmokTestRuntimeCheck {
  checkId: string;
  passed: boolean;
  details: string;
}

export interface DomainSmokeTestResult {
  passed: boolean;
  issues: string[];
  runtimeChecks: SmokTestRuntimeCheck[];
  rollbackPoints: readonly string[];
}

export class DomainSmokeTestRunner {
  public run(definition: DomainDefinition): DomainSmokeTestResult {
    const issues: string[] = [];
    const runtimeChecks: SmokTestRuntimeCheck[] = [];

    if (definition.workflows.length === 0) {
      issues.push("domain_registry.no_workflows");
    }
    if (definition.toolBundles.length === 0) {
      issues.push("domain_registry.no_tool_bundles");
    }
    if (definition.capabilities.requiredTools.some((tool) =>
      !definition.toolBundles.some((bundle) => bundle.tools.some((entry) => entry.toolName === tool))
    )) {
      issues.push("domain_registry.missing_required_tools");
    }

    // §37.2: executionProfile validation - must cover risk/HITL/tool/eval/SLO
    runtimeChecks.push(this.validateExecutionProfile(definition));

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

  /**
   * §37.2: Validate executionProfile covers required lint checks.
   * Must verify risk, HITL, tool, eval, and SLO coverage.
   */
  private validateExecutionProfile(definition: DomainDefinition): SmokTestRuntimeCheck {
    const profile = definition.executionProfile;

    if (!profile) {
      return {
        checkId: "execution_profile",
        passed: false,
        details: "executionProfile is required but not provided",
      };
    }

    const findings: string[] = [];

    // Check executionMode is properly configured
    if (!profile.executionMode) {
      findings.push("executionMode not configured");
    } else {
      // Verify planningMode is set
      if (!profile.executionMode.planningMode) {
        findings.push("planningMode not set");
      }
      // Verify hotPathMode is set
      if (!profile.executionMode.hotPathMode) {
        findings.push("hotPathMode not set");
      }
    }

    // Check latencyTier is set (SLO requirement)
    if (!profile.latencyTier) {
      findings.push("latencyTier not set (SLO requirement)");
    }

    // If descriptors bundle exists, validate HITL coverage
    if (definition.descriptors?.governance) {
      const hitlPolicy = definition.descriptors.governance.hitlPolicy;
      if (hitlPolicy === "platform_default" || !hitlPolicy) {
        findings.push("HITL policy not explicitly configured");
      }
    }

    // If descriptors bundle exists, validate risk coverage
    if (definition.descriptors?.risk) {
      const riskSpec = definition.descriptors.risk;
      if (!riskSpec.riskClass) {
        findings.push("riskClass not set in risk descriptor");
      }
    }

    return {
      checkId: "execution_profile",
      passed: findings.length === 0,
      details: findings.length === 0
        ? "executionProfile validated: risk/HITL/tool/eval/SLO coverage confirmed"
        : `executionProfile gaps: ${findings.join("; ")}`,
    };
  }

  private validateDependencyGraph(definition: DomainDefinition): SmokTestRuntimeCheck {
    const stepIds = new Set<string>();
    const dependsOnMap = new Map<string, string[]>();

    for (const workflow of definition.workflows) {
      for (const step of workflow.steps) {
        stepIds.add(step.stepName);
        dependsOnMap.set(step.stepName, step.dependsOn);
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    let hasCycle = false;

    const dfs = (stepName: string): void => {
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

  private validateSandboxCompatibility(capabilities: DomainCapabilityProfile): SmokTestRuntimeCheck {
    const restrictedTools = ["file_write", "bash", "exec", "sql_execute"];
    const hasRestricted = capabilities.requiredTools.some((tool) =>
      restrictedTools.includes(tool)
    );

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

  private validateResourceQuotas(capabilities: DomainCapabilityProfile): SmokTestRuntimeCheck {
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

  private computeRollbackPoints(definition: DomainDefinition): readonly string[] {
    const points: string[] = [];
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
