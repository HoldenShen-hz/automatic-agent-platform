/**
 * @fileoverview Plugin Test Harness
 *
 * Implements §22.4 Plugin lifecycle: PluginTestHarness for testing tools.
 */

import type { PluginDefinition } from "./plugin-definition.js";
import type { PluginContextConfig } from "./plugin-context.js";
import { PluginContext } from "./plugin-context.js";
import {
  type PluginLifecycleContext,
  type RegisteredPlugin,
  withLegacyMachineOutputProjection,
} from "../../domains/registry/plugin-spi.js";

// Local type definitions to avoid cross-module import issues
export interface MockLlmConfig {
  responses: Array<{ content: string; reasoning?: string; tools?: Array<{ name: string; input: Record<string, unknown> }> }>;
  delayMs?: number;
  errorRate?: number;
}

export interface MockToolResult {
  toolId: string;
  success: boolean;
  output: unknown;
  errorMessage?: string;
  durationMs: number;
}

/**
 * MockModelGateway - mock LLM gateway for plugin testing per §22.3
 * Supports record/replay mode where it plays back pre-recorded responses
 * without actual LLM execution, ensuring deterministic test behavior.
 */
export interface MockModelGateway {
  /** Unique identifier for this gateway instance */
  gatewayId: string;
  /** Whether this gateway is in record mode (true) or replay mode (false) */
  isRecording: boolean;
  /**
   * Record a response for a given input hash.
   * Only applicable in record mode.
   */
  record(inputHash: string, output: unknown): void;
  /**
   * Replay a pre-recorded response for a given input hash.
   * Returns null if no recording exists (in replay mode).
   */
  replay(inputHash: string): unknown | null;
  /**
   * Get all recorded input-output pairs.
   * Used for generating test fixtures.
   */
  getRecordings(): Array<{ inputHash: string; output: unknown }>;
  /**
   * Clear all recordings.
   */
  reset(): void;
}

/** Test harness mode - controls execution behavior */
export type HarnessMode = "live" | "mock" | "replay";

export interface PluginLiveExecutionRequest {
  input: Record<string, unknown>;
  context: PluginContext;
  plugin: PluginDefinition;
}

export type PluginLiveRunner = (request: PluginLiveExecutionRequest) => Promise<unknown>;

export interface TestHarnessConfig {
  plugin: PluginDefinition;
  mockLlm?: MockLlmConfig;
  mockTools?: MockToolResult[];
  /** Test harness mode per §22.3: live|mock|replay */
  mode?: HarnessMode;
  /** Mock model gateway for record/replay testing */
  mockGateway?: MockModelGateway;
  /** Optional executable runtime binding for live mode. */
  livePlugin?: RegisteredPlugin;
  /** Optional live runner for custom plugin host integration. */
  liveRunner?: PluginLiveRunner;
  timeoutMs?: number;
}

export interface TestCase {
  name: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  expectedError?: string;
}

export interface TestResult {
  caseName: string;
  passed: boolean;
  actualOutput: unknown;
  expectedOutput?: unknown;
  errorMessage?: string;
  durationMs: number;
}

export interface HarnessReport {
  pluginId: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  coveragePercent: number;
  results: TestResult[];
  timestamp: string;
}

/**
 * PluginTestHarness provides a testing environment for plugins.
 *
 * Supports:
 * - Running test cases with mock inputs
 * - Mock LLM responses for plugins that call the LLM
 * - Mock tool results for tool-using plugins
 * - MockModelGateway with record/replay per §22.3
 * - Coverage tracking
 */
export class PluginTestHarness {
  private plugin: PluginDefinition;
  private mockLlm: MockLlmConfig | null = null;
  private mockToolResults: Map<string, MockToolResult> = new Map();
  private timeoutMs: number;
  private mode: HarnessMode;
  private mockGateway: MockModelGateway | null;
  private livePlugin: RegisteredPlugin | null;
  private liveRunner: PluginLiveRunner | null;
  private livePluginLoaded = false;
  private livePluginActivated = false;

  constructor(config: TestHarnessConfig) {
    this.plugin = config.plugin;
    this.mockLlm = config.mockLlm ?? null;
    // Issue #2018 P1 FIX: Default to "live" mode for actual plugin execution.
    // Previously defaulted to "mock" which never executed the real plugin,
    // making the test harness ineffective for integration testing.
    this.mode = config.mode ?? "live";
    this.mockGateway = config.mockGateway ?? null;
    this.livePlugin = config.livePlugin ?? null;
    this.liveRunner = config.liveRunner ?? null;
    this.timeoutMs = config.timeoutMs ?? 30000;

    if (config.mockTools) {
      for (const tool of config.mockTools) {
        this.mockToolResults.set(tool.toolId, tool);
      }
    }
  }

  /**
   * Configure mock LLM responses.
   */
  configureMockLlm(config: MockLlmConfig): void {
    this.mockLlm = config;
  }

  /**
   * Add a mock tool result.
   */
  addMockToolResult(result: MockToolResult): void {
    this.mockToolResults.set(result.toolId, result);
  }

  /**
   * Run a single test case.
   */
  async runCase(caseInput: Record<string, unknown>): Promise<TestResult> {
    const startTime = Date.now();
    try {
      // Simulate plugin execution
      const output = await this.executePlugin(caseInput);
      return {
        caseName: "single-case",
        passed: true,
        actualOutput: output,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        caseName: "single-case",
        passed: false,
        actualOutput: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run multiple test cases and generate a report.
   */
  async runCases(cases: TestCase[]): Promise<HarnessReport> {
    const results: TestResult[] = [];
    let passedCases = 0;
    let failedCases = 0;

    for (const testCase of cases) {
      const startTime = Date.now();
      try {
        const actualOutput = await this.executePlugin(testCase.input);
        const passed = testCase.expectedOutput
          ? JSON.stringify(actualOutput) === JSON.stringify(testCase.expectedOutput)
          : true;

        if (passed) passedCases++;
        else failedCases++;

        results.push({
          caseName: testCase.name,
          passed,
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        failedCases++;
        results.push({
          caseName: testCase.name,
          passed: false,
          actualOutput: null,
          expectedOutput: testCase.expectedOutput,
          errorMessage: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        });
      }
    }

    const coveragePercent = cases.length > 0
      ? Math.round((passedCases / cases.length) * 100)
      : 0;

    return {
      pluginId: this.plugin.pluginId,
      totalCases: cases.length,
      passedCases,
      failedCases,
      coveragePercent,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a plugin context for testing.
   */
  createContext(config?: Partial<PluginContextConfig>): PluginContext {
    return new PluginContext({
      pluginId: this.plugin.pluginId,
      ...config,
    });
  }

  /**
   * Get the plugin definition.
   */
  getPlugin(): PluginDefinition {
    return this.plugin;
  }

  /**
   * Set the test harness mode (live|mock|replay).
   * §22.3 requires MockModelGateway with record/replay for non-live testing.
   */
  setMode(mode: HarnessMode): void {
    this.mode = mode;
  }

  /**
   * Set the mock model gateway for record/replay testing.
   * §22.3 requires MockModelGateway to avoid actual LLM execution.
   */
  setMockGateway(gateway: MockModelGateway): void {
    this.mockGateway = gateway;
  }

  private async executePlugin(input: Record<string, unknown>): Promise<unknown> {
    // Compute input hash for record/replay lookup
    const inputHash = hashInput(input);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`PluginTestHarness: execution timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      timeoutId.unref?.();
    });

    try {
      // In replay mode, try to use pre-recorded response
      if (this.mode === "replay" && this.mockGateway) {
        const recorded = this.mockGateway.replay(inputHash);
        if (recorded !== null) {
          return recorded;
        }
        // Fall through to mock if no recording found
      }

      // In mock or replay (no recording found) mode, use mock behavior
      if (this.mode === "mock" || this.mode === "replay") {
        // Use Promise.race to enforce timeout
        const executionPromise = this.executeMock(input, inputHash);
        return await Promise.race([executionPromise, timeoutPromise]);
      }

      // In live mode, execute the actual plugin with timeout enforcement
      if (this.mode === "live") {
        const executionPromise = this.executeLive(input);
        return await Promise.race([executionPromise, timeoutPromise]);
      }

      throw new Error(`PluginTestHarness: unknown mode ${this.mode}`);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Execute plugin in mock mode with mock tool results.
   */
  private async executeMock(input: Record<string, unknown>, inputHash: string): Promise<unknown> {
    // Simulate execution with mock delay
    await delay(10);

    // For tool plugins, try to use provided mock tool results
    if (this.plugin.type === "tool" && this.mockToolResults.size > 0) {
      const toolName = (input.toolName as string) ?? this.plugin.name;
      const mockResult = this.mockToolResults.get(toolName);
      if (mockResult) {
        const output = {
          success: mockResult.success,
          output: mockResult.output,
          errorMessage: mockResult.errorMessage,
          durationMs: mockResult.durationMs,
        };
        // In record mode, record the input-output pair
        if (this.mockGateway?.isRecording) {
          this.mockGateway.record(inputHash, output);
        }
        return output;
      }
    }

    // Use mock LLM responses if configured
    if (this.mockLlm?.responses?.length) {
      const response = this.mockLlm.responses[0];
      if (this.mockGateway?.isRecording) {
        this.mockGateway.record(inputHash, response);
      }
      return response;
    }

    // Fall back to placeholder output if no mock configured
    const output = { result: `Plugin ${this.plugin.pluginId} mock result`, input };

    // In record mode, record the input-output pair
    if (this.mockGateway?.isRecording) {
      this.mockGateway.record(inputHash, output);
    }

    return output;
  }

  /**
   * Execute plugin in live mode against actual plugin implementation.
   * Root cause: Previously threw an error claiming live execution wasn't supported.
   * Per spec, live mode should attempt to run the real plugin code when possible.
   * This implementation loads and executes the actual plugin's capabilities.
   */
  private async executeLive(input: Record<string, unknown>): Promise<unknown> {
    const context = this.createContext({
      resourceLimits: {
        maxMemoryMb: this.plugin.resourceLimits?.maxMemoryMb,
        maxCpuMs: this.plugin.resourceLimits?.maxCpuMs,
        maxDurationMs: this.plugin.resourceLimits?.maxDurationMs,
      },
    });

    if (this.liveRunner) {
      return this.liveRunner({ input, context, plugin: this.plugin });
    }

    if (this.livePlugin) {
      return this.executeLivePlugin(input, context);
    }

    throw new Error(
      `PluginTestHarness: live mode requires a bound liveRunner or livePlugin runtime for ${this.plugin.pluginId}.`
    );
  }

  private async executeLivePlugin(input: Record<string, unknown>, context: PluginContext): Promise<unknown> {
    const livePlugin = this.livePlugin;
    if (livePlugin == null) {
      throw new Error(`PluginTestHarness: no live plugin runtime is configured for ${this.plugin.pluginId}.`);
    }

    await this.ensureLivePluginReady(livePlugin, context, livePlugin.spiType === "adapter");

    switch (livePlugin.spiType) {
      case "tool":
        return livePlugin.execute({
          taskId: readString(input["taskId"], "plugin-test-task"),
          toolName: readString(input["toolName"], this.plugin.name),
          arguments: asRecord(input["arguments"]) ?? input,
          context: asRecord(input["context"]) ?? context.toRecord(),
        });
      case "retriever":
        return livePlugin.retrieve({
          taskId: readString(input["taskId"], "plugin-test-task"),
          intent: readString(input["intent"] ?? input["query"], "plugin-test"),
          context: asRecord(input["context"]) ?? input,
          tokenBudget: readNumber(input["tokenBudget"], 1024),
        });
      case "validator":
        {
          const nodeIdOpt = readOptionalString(input["nodeId"] ?? input["stepId"]);
          const stepIdOpt = readOptionalString(input["stepId"]);
          return livePlugin.validate({
            ...(nodeIdOpt !== undefined && { nodeId: nodeIdOpt }),
            ...(stepIdOpt !== undefined && { stepId: stepIdOpt }),
            machineOutput: buildMachineOutput(input),
            contract: asRecord(input["contract"]) ?? {},
          });
        }
      case "planner":
        return livePlugin.suggestWorkflow({
          taskId: readString(input["taskId"], "plugin-test-task"),
          intent: readString(input["intent"], "plugin-test"),
          assessment: (input["assessment"] ?? {}) as never,
        });
      case "presenter":
        return livePlugin.formatOutput({
          machineOutputs: Array.isArray(input["machineOutputs"]) ? input["machineOutputs"] as never[] : [buildMachineOutput(input)],
          artifacts: Array.isArray(input["artifacts"]) ? input["artifacts"] as never[] : [],
          audience: readAudience(input["audience"]),
        });
      case "evaluator":
        {
          const nodeIdOpt = readOptionalString(input["nodeId"] ?? input["stepId"]);
          const stepIdOpt = readOptionalString(input["stepId"]);
          return livePlugin.evaluate({
            taskId: readString(input["taskId"], "plugin-test-task"),
            ...(nodeIdOpt !== undefined && { nodeId: nodeIdOpt }),
            ...(stepIdOpt !== undefined && { stepId: stepIdOpt }),
            machineOutput: buildMachineOutput(input),
            criteria: asRecord(input["criteria"]) ?? {},
            context: asRecord(input["context"]) ?? context.toRecord(),
          });
        }
      case "adapter": {
        if (asRecord(input["credentials"])) {
          await livePlugin.authenticate(asRecord(input["credentials"]) ?? {});
        }
        await this.ensureLivePluginReady(livePlugin, context, false);
        return livePlugin.execute(
          readString(input["action"], "execute"),
          asRecord(input["params"]) ?? input,
        );
      }
      default: {
        throw new Error(`PluginTestHarness: unsupported live plugin spi type ${(livePlugin as { spiType: string }).spiType}`);
      }
    }
  }

  private async ensureLivePluginReady(
    livePlugin: RegisteredPlugin,
    context: PluginContext,
    deferActivation: boolean,
  ): Promise<void> {
    const lifecycleContext = buildLifecycleContext(livePlugin, context);

    if (!this.livePluginLoaded) {
      if (livePlugin.initialize) {
        await livePlugin.initialize();
      }
      if (livePlugin.onLoad) {
        await livePlugin.onLoad(lifecycleContext);
      }
      this.livePluginLoaded = true;
    }

    if (deferActivation || this.livePluginActivated) {
      return;
    }

    if (livePlugin.onActivate) {
      await livePlugin.onActivate(lifecycleContext);
    }
    if (livePlugin.healthCheck) {
      const healthy = await livePlugin.healthCheck();
      if (!healthy) {
        throw new Error(`PluginTestHarness: live plugin ${livePlugin.pluginId} failed health check.`);
      }
    }
    this.livePluginActivated = true;
  }
}

/**
 * Compute a simple hash of the input for record/replay lookup.
 * In production, use a proper hash function.
 */
function hashInput(input: Record<string, unknown>): string {
  const str = JSON.stringify(input, Object.keys(input).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLifecycleContext(plugin: RegisteredPlugin, context: PluginContext): PluginLifecycleContext {
  return {
    pluginId: plugin.pluginId,
    domainId: "domainId" in plugin ? plugin.domainId : null,
    capabilityIds: [...(plugin.capabilityIds ?? [])],
    bindingId: null,
    config: context.toRecord(),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readAudience(value: unknown): "end_user" | "developer" | "reviewer" | "operator" {
  return value === "developer" || value === "reviewer" || value === "operator"
    ? value
    : "end_user";
}

function buildMachineOutput(input: Record<string, unknown>): {
  nodeId?: string | null;
  nodeRunId?: string | null;
  attemptId?: string | null;
  stepId?: string | null;
  outputRef: string | null;
  payload: Record<string, unknown>;
} {
  return withLegacyMachineOutputProjection({
    nodeId: readOptionalString(input["nodeId"]) ?? null,
    nodeRunId: readOptionalString(input["nodeRunId"]) ?? null,
    attemptId: readOptionalString(input["attemptId"]) ?? null,
    stepId: readOptionalString(input["stepId"]) ?? null,
    outputRef: readOptionalString(input["outputRef"]) ?? null,
    payload: asRecord(input["payload"]) ?? input,
  });
}
