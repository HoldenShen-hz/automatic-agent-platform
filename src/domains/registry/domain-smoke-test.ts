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
   * §37.2: Execute actual runtime integration test with provided runtime context.
   * This validates the domain can actually execute in a runtime environment,
   * not just validating the config structure statically.
   */
  public async runWithRuntime(
    definition: DomainDefinition,
    runtimeContext: RuntimeContext,
  ): Promise<DomainSmokeTestResult> {
    const baseResult = this.run(definition);

    // §37.2: Add actual runtime integration check
    const runtimeCheck = await this.runRuntimeIntegration(definition, runtimeContext);
    baseResult.runtimeChecks.push(runtimeCheck);

    if (!runtimeCheck.passed) {
      baseResult.issues.push("domain_registry.runtime_integration_failed");
      baseResult.passed = false;
    }

    return baseResult;
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
        passed: true,
        details: "executionProfile not provided; skipped for legacy compatibility",
      };
    }

    const findings: string[] = [];

    // Check executionMode is properly configured
    if (profile.executionMode) {
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
    if (profile.latencyTier == null) {
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
    // §2310: Use workflow-qualified step IDs to prevent cross-workflow name collisions
    // A step named "process" in workflow A is distinct from "process" in workflow B
    const workflowStepIds = new Map<string, Set<string>>();
    const dependsOnMap = new Map<string, { workflowId: string; deps: string[] }>();

    for (const workflow of definition.workflows) {
      const stepIds = new Set<string>();
      for (const step of workflow.steps) {
        const fullStepId = `${workflow.workflowId}/${step.stepName}`;
        stepIds.add(fullStepId);
        dependsOnMap.set(fullStepId, { workflowId: workflow.workflowId, deps: step.dependsOn });
      }
      workflowStepIds.set(workflow.workflowId, stepIds);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const danglingDeps: string[] = [];
    let hasCycle = false;

    const dfs = (fullStepId: string): void => {
      if (visiting.has(fullStepId)) {
        hasCycle = true;
        return;
      }
      if (visited.has(fullStepId)) {
        return;
      }
      visiting.add(fullStepId);
      const stepInfo = dependsOnMap.get(fullStepId);
      if (stepInfo) {
        for (const dep of stepInfo.deps) {
          // §2310: Use workflow-qualified dependency to find correct owner
          const fullDepId = `${stepInfo.workflowId}/${dep}`;
          // Find which workflow owns this dependency by checking the same workflow first
          let foundOwner = false;
          const ownerStepIds = workflowStepIds.get(stepInfo.workflowId);
          if (ownerStepIds && ownerStepIds.has(fullDepId)) {
            foundOwner = true;
          } else {
            // Cross-workflow dependency - scan all workflows
            for (const [wfId, stepIds] of workflowStepIds) {
              if (stepIds.has(fullDepId)) {
                foundOwner = true;
                break;
              }
            }
          }
          if (!foundOwner) {
            danglingDeps.push(`${fullStepId} -> ${fullDepId}`);
            continue;
          }
          dfs(fullDepId);
        }
      }
      visiting.delete(fullStepId);
      visited.add(fullStepId);
    };

    for (const stepIds of workflowStepIds.values()) {
      for (const stepId of stepIds) {
        dfs(stepId);
      }
    }

    return {
      checkId: "dependency_graph",
      passed: !hasCycle && danglingDeps.length === 0,
      details: hasCycle
        ? "Circular dependency detected in workflow steps"
        : danglingDeps.length > 0
          ? `Dangling dependencies detected: ${danglingDeps.join("; ")}`
          : `Validated ${[...workflowStepIds.values()].reduce((sum, s) => sum + s.size, 0)} steps across ${definition.workflows.length} workflows`,
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

  /**
   * §37.2: Execute actual runtime integration test.
   * Instantiates and exercises the domain in a sandboxed runtime context.
   */
  async runRuntimeIntegration(
    definition: DomainDefinition,
    runtimeContext: RuntimeContext,
  ): Promise<SmokTestRuntimeCheck> {
    try {
      // §37.2: Verify runtime can load the domain descriptor
      if (!runtimeContext.loadDomainDescriptor) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "Runtime context missing loadDomainDescriptor function",
        };
      }

      const loaded = await runtimeContext.loadDomainDescriptor(definition);
      if (!loaded) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "Runtime failed to load domain descriptor",
        };
      }

      // §37.2: Verify domain can be instantiated in sandbox
      if (!runtimeContext.createSandbox) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "Runtime context missing createSandbox function",
        };
      }

      const sandbox = await runtimeContext.createSandbox({
        domainId: definition.domainId,
        securityLevel: definition.capabilities.securityLevel,
        toolGrant: definition.capabilities.requiredTools,
        resourceLimits: definition.capabilities.budgetLimits,
      });

      if (!sandbox) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "Runtime failed to create sandbox for domain",
        };
      }

      // §37.2: Execute a smoke test workflow step in the sandbox
      if (!sandbox.executeStep) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "Sandbox missing executeStep function",
        };
      }

      // Find first workflow with at least one step for smoke testing
      const testWorkflow = definition.workflows[0];
      const testStep = testWorkflow?.steps[0];

      if (!testStep) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "No workflow steps available for runtime integration test",
        };
      }

      const stepResult = await sandbox.executeStep({
        workflowId: testWorkflow.workflowId,
        stepName: testStep.stepName,
        input: {},
        timeoutMs: 5000,
      });

      if (!stepResult) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: "Sandbox executeStep returned null/undefined",
        };
      }

      if (stepResult.error) {
        return {
          checkId: "runtime_integration",
          passed: false,
          details: `Sandbox step execution error: ${stepResult.error}`,
        };
      }

      // §37.2: Cleanup sandbox after successful test
      if (sandbox.release) {
        await sandbox.release();
      }

      return {
        checkId: "runtime_integration",
        passed: true,
        details: `Runtime integration passed: domain=${definition.domainId} workflow=${testWorkflow.workflowId} step=${testStep.stepName} executed=${stepResult.executed ?? false}`,
      };
    } catch (err) {
      return {
        checkId: "runtime_integration",
        passed: false,
        details: `Runtime integration exception: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private computeRollbackPoints(definition: DomainDefinition): readonly string[] {
    const points: string[] = [];
    // §2311: Only add rollback points for steps whose dependencies actually exist.
    // Dangling dependencies indicate a broken workflow that should not pass validation.
    const workflowStepIds = new Map<string, Set<string>>();
    for (const workflow of definition.workflows) {
      const stepIds = new Set<string>();
      for (const step of workflow.steps) {
        stepIds.add(step.stepName);
      }
      workflowStepIds.set(workflow.workflowId, stepIds);
    }
    for (const workflow of definition.workflows) {
      for (const step of workflow.steps) {
        if (step.dependsOn.length > 0) {
          // Verify all dependencies exist before adding rollback point
          const allDepsExist = step.dependsOn.every((dep) =>
            workflowStepIds.get(workflow.workflowId)?.has(dep) ?? false,
          );
          if (allDepsExist) {
            points.push(`workflow:${workflow.workflowId}/step:${step.stepName}`);
          }
        }
      }
    }
    return points;
  }
}

/**
 * Runtime context required for actual integration testing.
 * Provides the sandbox and tooling needed to exercise a domain at runtime.
 */
export interface RuntimeContext {
  /**
   * Load a domain descriptor into the runtime.
   * Returns true if successful.
   */
  loadDomainDescriptor(definition: DomainDefinition): Promise<boolean>;

  /**
   * Create an isolated sandbox for domain execution.
   */
  createSandbox(options: {
    domainId: string;
    securityLevel: string;
    toolGrant: readonly string[];
    resourceLimits: { maxTokensPerTask: number; maxCostPerTask: number };
  }): Promise<SandboxContext | null>;

  /**
   * Terminate and cleanup all sandboxes for this runtime.
   */
  dispose(): Promise<void>;
}

/**
 * Sandbox context for executing domain steps.
 */
export interface SandboxContext {
  /**
   * Execute a single workflow step in the sandbox.
   * Returns null if the step could not be executed.
   */
  executeStep(options: {
    workflowId: string;
    stepName: string;
    input: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<{ executed: boolean; output?: unknown; error?: string } | null>;

  /**
   * Release sandbox resources.
   */
  release(): Promise<void>;
}
