/**
 * @fileoverview Plugin Test Harness
 *
 * Implements §22.4 Plugin lifecycle: PluginTestHarness for testing tools.
 */
import type { PluginDefinition } from "./plugin-definition.js";
import type { PluginContextConfig } from "./plugin-context.js";
import { PluginContext } from "./plugin-context.js";
export interface MockLlmConfig {
    responses: Array<{
        content: string;
        reasoning?: string;
        tools?: Array<{
            name: string;
            input: Record<string, unknown>;
        }>;
    }>;
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
    mockLlm?: MockLlmConfig;
    mockTools?: MockToolResult[];
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
 * - Coverage tracking
 */
export declare class PluginTestHarness {
    private plugin;
    private mockLlm;
    private mockToolResults;
    private timeoutMs;
    constructor(config: TestHarnessConfig);
    /**
     * Configure mock LLM responses.
     */
    configureMockLlm(config: MockLlmConfig): void;
    /**
     * Add a mock tool result.
     */
    addMockToolResult(result: MockToolResult): void;
    /**
     * Run a single test case.
     */
    runCase(caseInput: Record<string, unknown>): Promise<TestResult>;
    /**
     * Run multiple test cases and generate a report.
     */
    runCases(cases: TestCase[]): Promise<HarnessReport>;
    /**
     * Create a plugin context for testing.
     */
    createContext(config?: Partial<PluginContextConfig>): PluginContext;
    /**
     * Get the plugin definition.
     */
    getPlugin(): PluginDefinition;
    private executePlugin;
}
