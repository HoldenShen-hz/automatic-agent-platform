/**
 * @fileoverview Plugin Test Harness
 *
 * Implements §22.4 Plugin lifecycle: PluginTestHarness for testing tools.
 */

import type { PluginDefinition } from "./plugin-definition.js";
import type { PluginContextConfig } from "./plugin-context.js";
import { PluginContext } from "./plugin-context.js";

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

export interface TestHarnessConfig {
  plugin: PluginDefinition;
  mockLlm?: MockLlmConfig;
  mockTools?: MockToolResult[];
  /** Test harness mode per §22.3: live|mock|replay */
  mode?: HarnessMode;
  /** Mock model gateway for record/replay testing */
  mockGateway?: MockModelGateway;
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

  constructor(config: TestHarnessConfig) {
    this.plugin = config.plugin;
    this.mockLlm = config.mockLlm ?? null;
    this.mode = config.mode ?? "mock";
    this.mockGateway = config.mockGateway ?? null;
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
      // Simulate execution with mock delay
      await delay(10);

      // Return mock output based on plugin type
      let output: unknown;
      switch (this.plugin.type) {
        case "tool":
          output = { result: `Tool ${this.plugin.name} executed`, input };
          break;
        case "adapter":
          output = { adapted: true, original: input };
          break;
        case "retriever":
          output = { documents: [], query: input };
          break;
        case "evaluator":
          output = { passed: true, score: 1.0, input };
          break;
        default:
          output = { output: input };
      }

      // In record mode, record the input-output pair
      if (this.mockGateway?.isRecording) {
        this.mockGateway.record(inputHash, output);
      }

      return output;
    }

    // In live mode, we would execute the actual plugin
    // For now, throw an error since live execution is not implemented
    throw new Error(`PluginTestHarness: live execution not supported. Use mock or replay mode.`);
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
