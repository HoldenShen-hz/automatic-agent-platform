/**
 * @fileoverview Pack Local Test Service
 *
 * Implements §22.2 Pack SDK core capability: `test(options)`.
 * Provides local sandbox testing with mock LLM and mock tools.
 */
export type TestMode = "unit" | "integration" | "simulation";
export interface TestOptions {
    packId: string;
    version: string;
    mode: TestMode;
    mockLlm: boolean;
    evalDatasetId?: string;
    recordArtifacts: boolean;
    timeoutMs?: number;
}
export interface TestReport {
    packId: string;
    version: string;
    mode: TestMode;
    passed: boolean;
    durationMs: number;
    coveragePercent: number;
    casesPassed: number;
    casesFailed: number;
    artifacts: string[];
    findings: string[];
    timestamp: string;
}
/**
 * Mock LLM response for deterministic testing.
 */
export interface MockLlmResponse {
    content: string;
    reasoning?: string;
    tools?: Array<{
        name: string;
        input: Record<string, unknown>;
    }>;
}
export interface MockLlmConfig {
    responses: MockLlmResponse[];
    delayMs?: number;
    errorRate?: number;
}
/**
 * Mock tool execution result.
 */
export interface MockToolResult {
    toolId: string;
    success: boolean;
    output: unknown;
    errorMessage?: string;
    durationMs: number;
}
export declare class PackTestLocalService {
    private mockLlmConfig;
    private mockToolResults;
    private testFixtures;
    /**
     * Configure mock LLM responses for testing.
     */
    configureMockLlm(config: MockLlmConfig): void;
    /**
     * Add a mock tool result.
     */
    addMockToolResult(result: MockToolResult): void;
    /**
     * Load test fixtures from recording.
     */
    loadFixtures(fixtures: Record<string, unknown>): void;
    /**
     * Run local tests for a Pack.
     */
    test(options: TestOptions): Promise<TestReport>;
    /**
     * Playback a recorded LLM interaction.
     */
    playbackFixture(fixtureId: string): Promise<MockLlmResponse | null>;
    private runUnitTests;
    private runIntegrationTests;
    private runSimulationTests;
    private evaluateFixtureCases;
    private collectFixtures;
}
