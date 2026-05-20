/**
 * @fileoverview Pack Local Test Service
 *
 * Implements §22.2 Pack SDK core capability: `test(options)`.
 * Provides local sandbox testing with mock LLM and mock tools.
 */

import { ValidationError } from "../../platform/contracts/errors.js";

export type TestMode = "unit" | "integration" | "simulation";

export interface TestOptions {
  packId: string;
  version: string;
  mode: TestMode;
  mockLlm: boolean;
  evalDatasetId?: string;
  recordArtifacts: boolean;
  timeoutMs?: number;
  timeoutProfileMs?: Partial<Record<TestMode, number>>;
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
  tools?: Array<{ name: string; input: Record<string, unknown> }>;
}

export interface MockLlmConfig {
  responses: MockLlmResponse[];
  delayMs?: number;
  errorRate?: number;
  errorSeed?: number;
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

const DEFAULT_TIMEOUT_PROFILE_MS: Readonly<Record<TestMode, number>> = Object.freeze({
  unit: 30_000,
  integration: 60_000,
  simulation: 120_000,
});

export class PackTestLocalService {
  private mockLlmConfig: MockLlmConfig | null = null;
  private mockToolResults: Map<string, MockToolResult> = new Map();
  private testFixtures: Map<string, unknown> = new Map();
  private errorPrngState = 0x5eed1234;

  /**
   * Configure mock LLM responses for testing.
   */
  configureMockLlm(config: MockLlmConfig): void {
    this.mockLlmConfig = config;
  }

  /**
   * Add a mock tool result.
   */
  addMockToolResult(result: MockToolResult): void {
    this.mockToolResults.set(result.toolId, result);
  }

  /**
   * Load test fixtures from recording.
   */
  loadFixtures(fixtures: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(fixtures)) {
      this.testFixtures.set(key, value);
    }
  }

  /**
   * Run local tests for a Pack.
   */
  async test(options: TestOptions): Promise<TestReport> {
    const startTime = Date.now();
    validateTestOptions(options);

    const { packId, version, mode, mockLlm, evalDatasetId, recordArtifacts, timeoutMs } = options;
    const effectiveTimeoutMs = resolveTimeout(timeoutMs, options.timeoutProfileMs?.[mode] ?? defaultTimeoutForMode(mode));
    const findings: string[] = [];
    const artifacts: string[] = [];

    // Run tests based on mode
    let casesPassed = 0;
    let casesFailed = 0;
    let coveragePercent = 0;

    switch (mode) {
      case "unit":
        ({ casesPassed, casesFailed, coveragePercent } = await this.runUnitTests(packId, effectiveTimeoutMs));
        break;
      case "integration":
        ({ casesPassed, casesFailed, coveragePercent } = await this.runIntegrationTests(packId, mockLlm, effectiveTimeoutMs));
        break;
      case "simulation":
        ({ casesPassed, casesFailed, coveragePercent } = await this.runSimulationTests(
          packId,
          evalDatasetId,
          recordArtifacts,
          effectiveTimeoutMs,
        ));
        break;
    }

    if (recordArtifacts) {
      const artifactPath = `artifact://test-reports/${packId}@${version}/${mode}-${Date.now()}.json`;
      artifacts.push(artifactPath);
    }

    const durationMs = Date.now() - startTime;
    const passed = casesFailed === 0;

    if (casesFailed > 0) {
      findings.push(`test_local.some_cases_failed:${casesFailed}`);
    }
    if (coveragePercent < 80) {
      findings.push(`test_local.coverage_below_threshold:${coveragePercent}`);
    }

    return {
      packId,
      version,
      mode,
      passed,
      durationMs,
      coveragePercent,
      casesPassed,
      casesFailed,
      artifacts,
      findings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Playback a recorded LLM interaction.
   */
  async playbackFixture(fixtureId: string): Promise<MockLlmResponse | null> {
    const fixture = this.testFixtures.get(fixtureId);
    if (!fixture) {
      return null;
    }
    if (this.mockLlmConfig?.delayMs) {
      await sleep(this.mockLlmConfig.delayMs);
    }
    if (this.mockLlmConfig?.errorRate && this.nextErrorSample() < this.mockLlmConfig.errorRate) {
      throw new Error("Mock LLM error");
    }
    return fixture as MockLlmResponse;
  }

  private nextErrorSample(): number {
    const seed = this.mockLlmConfig?.errorSeed ?? this.errorPrngState;
    this.errorPrngState = (1664525 * seed + 1013904223) >>> 0;
    return this.errorPrngState / 0x100000000;
  }

  private async runUnitTests(packId: string, timeoutMs: number): Promise<{
    casesPassed: number;
    casesFailed: number;
    coveragePercent: number;
  }> {
    return this.runModeWithTimeout(timeoutMs, async () =>
      this.evaluateFixtureCases(packId, "unit", {
        requireFixtures: false,
      }));
  }

  private async runIntegrationTests(packId: string, mockLlm: boolean, timeoutMs: number): Promise<{
    casesPassed: number;
    casesFailed: number;
    coveragePercent: number;
  }> {
    const result = await this.runModeWithTimeout(timeoutMs, async () =>
      this.evaluateFixtureCases(packId, "integration", {
        requireMockLlm: mockLlm,
        requireFixtures: true,
      }));
    if (!mockLlm && result.casesPassed > 0) {
      return {
        ...result,
        casesPassed: Math.max(0, result.casesPassed - 1),
        casesFailed: result.casesFailed + 1,
        coveragePercent: Math.max(0, result.coveragePercent - 10),
      };
    }
    return result;
  }

  private async runSimulationTests(packId: string, evalDatasetId: string | undefined, recordArtifacts: boolean, timeoutMs: number): Promise<{
    casesPassed: number;
    casesFailed: number;
    coveragePercent: number;
  }> {
    const result = await this.runModeWithTimeout(timeoutMs, async () =>
      this.evaluateFixtureCases(packId, "simulation", {
        requireEvalDataset: evalDatasetId != null,
        requireFixtures: true,
      }));
    return evalDatasetId == null
      ? {
          ...result,
          coveragePercent: Math.max(0, result.coveragePercent - (recordArtifacts ? 15 : 20)),
        }
      : result;
  }

  private evaluateFixtureCases(
    packId: string,
    mode: TestMode,
    options: {
      requireMockLlm?: boolean;
      requireEvalDataset?: boolean;
      requireFixtures?: boolean;
    },
  ): {
    casesPassed: number;
    casesFailed: number;
    coveragePercent: number;
  } {
    const fixtures = this.collectFixtures(packId, mode);
    if (fixtures.length === 0 && options.requireFixtures === true) {
      return {
        casesPassed: 0,
        casesFailed: 1,
        coveragePercent: 0,
      };
    }
    const cases = fixtures;

    let casesPassed = 0;
    let casesFailed = 0;
    let coverageWeight = 0;
    let executedWeight = 0;

    for (const fixture of cases) {
      const requiredToolIds = fixture.requiredToolIds ?? [];
      const missingTool = requiredToolIds.find((toolId) => this.mockToolResults.get(toolId)?.success !== true) ?? null;
      const llmFailure = options.requireMockLlm === true
        && (fixture.fixtureId == null || !this.testFixtures.has(fixture.fixtureId))
        && this.mockLlmConfig == null;
      const evalDatasetFailure = options.requireEvalDataset === true && fixture.requiresEvalDataset !== true;
      const passed = fixture.passed !== false && missingTool == null && !llmFailure && !evalDatasetFailure;
      if (passed) {
        casesPassed += 1;
      } else {
        casesFailed += 1;
      }
      const weight = fixture.coverageWeight ?? 1;
      coverageWeight += weight;
      if (passed) {
        executedWeight += weight;
      }
    }

    const coveragePercent = coverageWeight === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((executedWeight / coverageWeight) * 100)));

    return {
      casesPassed,
      casesFailed,
      coveragePercent,
    };
  }

  private collectFixtures(packId: string, mode: TestMode): Array<{
    caseId: string;
    passed?: boolean;
    coverageWeight?: number;
    requiredToolIds?: string[];
    fixtureId?: string;
    requiresEvalDataset?: boolean;
  }> {
    return [...this.testFixtures.entries()]
      .map(([fixtureId, value]) => ({ fixtureId, value }))
      .filter(({ fixtureId, value }) => {
        if (fixtureId.startsWith(`${mode}:`)) {
          return true;
        }
        if (value != null && typeof value === "object") {
          const record = value as Record<string, unknown>;
          return record["mode"] === mode && (record["packId"] == null || record["packId"] === packId);
        }
        return false;
      })
      .map(({ fixtureId, value }, index) => {
        const record = value != null && typeof value === "object" ? value as Record<string, unknown> : {};
        return {
          caseId: typeof record["caseId"] === "string" ? record["caseId"] : `${mode}:${packId}:${index + 1}`,
          passed: typeof record["passed"] === "boolean" ? record["passed"] : true,
          coverageWeight: typeof record["coverageWeight"] === "number" ? record["coverageWeight"] : 1,
          requiredToolIds: Array.isArray(record["requiredToolIds"]) ? record["requiredToolIds"].filter((item): item is string => typeof item === "string") : [],
          fixtureId,
          requiresEvalDataset: record["requiresEvalDataset"] === true,
        };
      });
  }

  private async runModeWithTimeout<T>(timeoutMs: number, runner: () => Promise<T> | T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(runner),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new ValidationError("test_local.timeout_exceeded", `test_local.timeout_exceeded:${timeoutMs}`));
          }, timeoutMs);
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer != null) {
        clearTimeout(timer);
      }
    }
  }
}

function validateTestOptions(options: TestOptions): void {
  if (!options.packId?.trim()) {
    throw new ValidationError("test_local.invalid_pack_id", "Pack ID is required.");
  }
  if (!options.version?.trim()) {
    throw new ValidationError("test_local.invalid_version", "Version is required.");
  }
  if (!["unit", "integration", "simulation"].includes(options.mode)) {
    throw new ValidationError("test_local.invalid_mode", `Mode must be one of: unit, integration, simulation. Got: ${options.mode}`);
  }
  if (options.timeoutMs !== undefined && options.timeoutMs < 0) {
    throw new ValidationError("test_local.invalid_timeout", "Timeout must be positive.");
  }
}

function resolveTimeout(value: number | undefined, fallback: number): number {
  return value == null || value === 0 ? fallback : value;
}

function defaultTimeoutForMode(mode: TestMode): number {
  return DEFAULT_TIMEOUT_PROFILE_MS[mode];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
