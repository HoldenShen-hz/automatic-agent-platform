export type EvalStatus = "pending" | "running" | "passed" | "failed" | "degraded";
export type EvalSuiteKind = "golden" | "regression" | "ab_test" | "smoke";
export type QualityVerdict = "pass" | "fail" | "degraded" | "inconclusive";
export type EvalStructuredOutput =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | Array<unknown>;

export interface EvalSuiteRecord {
  id: string;
  name: string;
  kind: EvalSuiteKind;
  description: string;
  cases: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvalRunRecord {
  id: string;
  suiteId: string;
  modelId: string;
  promptVersion: string;
  status: EvalStatus;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  averageScore: number | null;
  verdict: QualityVerdict;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
  metadata: string | null;
}

export interface EvalCaseDefinition {
  id: string;
  input: string;
  expectedOutput: string;
  tags?: string[];
  priority?: "critical" | "high" | "medium" | "low";
}

export interface EvalCaseResult {
  id: string;
  runId: string;
  caseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  score: number;
  passed: boolean;
  latencyMs: number;
  metadata: string | null;
}

export interface AbTestConfig {
  controlModelId: string;
  treatmentModelId: string;
  controlPromptVersion: string;
  treatmentPromptVersion: string;
  minSampleSize: number;
  significanceThreshold: number;
  passThreshold?: number;
}

export interface AbTestCaseEvaluatorInput extends EvalCaseEvaluatorInput {
  arm: "control" | "treatment";
  expectedOutput: string;
}

export interface AbTestCaseEvaluation {
  actualOutput: EvalStructuredOutput;
  score: number;
  latencyMs?: number;
}

export interface AbTestOptions {
  llmEvaluator?: {
    evaluateCase: (input: AbTestCaseEvaluatorInput) => Promise<AbTestCaseEvaluation> | AbTestCaseEvaluation;
  };
  llmClient?: LlmEvaluationClient;
}

export interface LlmEvaluationClient {
  evaluate(input: {
    modelId: string;
    promptVersion: string;
    input: string;
    expectedOutput: string;
  }): Promise<{
    actualOutput: EvalStructuredOutput;
    score: number;
    latencyMs: number;
  }>;
}

export interface AbTestResult {
  controlRunId: string;
  treatmentRunId: string;
  controlAvgScore: number;
  treatmentAvgScore: number;
  improvement: number;
  significant: boolean;
  pValue: number;
  verdict: QualityVerdict;
  mockEvaluation: boolean;
  zScore: number;
  confidenceInterval: [number, number];
}

export interface CiGateResult {
  passed: boolean;
  runId: string;
  verdict: QualityVerdict;
  regressions: string[];
  improvements: string[];
  summary: string;
  independenceViolation?: string;
}

export interface EvalCaseEvaluation {
  actualOutput: EvalStructuredOutput;
  score: number;
  passed: boolean;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface EvalCaseEvaluatorInput {
  suite: EvalSuiteRecord;
  caseDefinition: EvalCaseDefinition;
  modelId: string;
  promptVersion: string;
}

export type EvalCaseEvaluator = (
  input: EvalCaseEvaluatorInput,
) => EvalCaseEvaluation;

export interface CiGateOptions {
  evaluator?: EvalCaseEvaluator;
  baselinePromptVersion?: string | null;
  improvementScoreThreshold?: number;
  passingVerdicts?: readonly QualityVerdict[];
  enforceIndependenceForHighRisk?: boolean;
  independentJudgeId?: string;
}
