/**
 * @fileoverview Plugin Test Harness
 *
 * Implements §22.4 Plugin lifecycle: PluginTestHarness for testing tools.
 */

import type { PluginDefinition } from "./plugin-definition.js";
import type { PluginContextConfig } from "./plugin-context.js";
import { PluginContext } from "./plugin-context.js";
import type { DomainToolPlugin } from "../../domains/registry/plugin-spi.js";
import { ValidationError } from "../../platform/contracts/errors.js";

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

export interface TestHarnessConfig {
  plugin: PluginDefinition;
  mode?: "mock" | "live";
  mockLlm?: MockLlmConfig;
  mockTools?: MockToolResult[];
  timeoutMs?: number;
  livePlugin?: DomainToolPlugin;
  liveRunner?: (input: Record<string, unknown>) => Promise<unknown> | unknown;
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
 * - Coverage tracking
 */
export class PluginTestHarness {
  private plugin: PluginDefinition;
  private mode: "mock" | "live";
  private mockLlm: MockLlmConfig | null = null;
  private mockToolResults: Map<string, MockToolResult> = new Map();
  private timeoutMs: number;
  private livePlugin: DomainToolPlugin | null;
  private liveRunner: ((input: Record<string, unknown>) => Promise<unknown> | unknown) | null;

  constructor(config: TestHarnessConfig) {
    this.plugin = config.plugin;
    this.mode = config.mode ?? "mock";
    this.mockLlm = config.mockLlm ?? null;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.livePlugin = config.livePlugin ?? null;
    this.liveRunner = config.liveRunner ?? null;

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
      const output = await this.executeWithTimeout(caseInput);
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
        const actualOutput = await this.executeWithTimeout(testCase.input);
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

  // R15-06 FIX: PluginTestHarness.executePlugin() currently hardcodes mock responses.
  // Per §22.3, this should use MockModelGateway with record/replay capability.
  // The current implementation does not perform actual plugin execution.
  // MockModelGateway record/replay support belongs in the plugin-harness contract.
  private async executeWithTimeout(input: Record<string, unknown>): Promise<unknown> {
    const execution = this.executePlugin(input);
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Plugin execution timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      execution.finally(() => clearTimeout(timer)).catch(() => undefined);
    });
    return Promise.race([execution, timeout]);
  }

  private async executePlugin(input: Record<string, unknown>): Promise<unknown> {
    if (this.mode === "live") {
      if (this.liveRunner) {
        return this.liveRunner(input);
      }
      if (this.livePlugin?.execute) {
        return this.livePlugin.execute(input);
      }
      throw new ValidationError(
        "plugin_test_harness.live_runtime_required",
        "Live mode requires a bound liveRunner or livePlugin runtime",
      );
    }

    await delay(this.mockLlm?.delayMs ?? 10);

    // Return mock output based on plugin type
    switch (this.plugin.type) {
      case "tool":
        return { result: `Tool ${this.plugin.name} executed`, input };
      case "adapter":
        return { adapted: true, original: input };
      case "retriever":
        return { documents: [], query: input };
      case "evaluator":
        return { passed: true, score: 1.0, input };
      default:
        return { output: input };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
