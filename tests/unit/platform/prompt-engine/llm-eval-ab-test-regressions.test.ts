import assert from "node:assert/strict";
import test from "node:test";

import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";

function createInMemoryDb() {
  const suites = new Map<string, Record<string, unknown>>();
  const runs = new Map<string, Record<string, unknown>>();
  const caseResults: Record<string, unknown>[] = [];

  return {
    connection: {
      exec() {},
      prepare(sql: string) {
        return {
          run(...args: unknown[]) {
            if (sql.startsWith("INSERT INTO eval_suites")) {
              const [id, name, kind, description, cases, createdAt, updatedAt] = args;
              suites.set(String(id), {
                id,
                name,
                kind,
                description,
                cases,
                created_at: createdAt,
                updated_at: updatedAt,
              });
              return;
            }
            if (sql.startsWith("INSERT INTO eval_runs")) {
              const [id, suiteId, modelId, promptVersion, status, totalCases, passedCases, failedCases, averageScore, verdict, startedAt, completedAt, triggeredBy, metadata] = args;
              runs.set(String(id), {
                id,
                suite_id: suiteId,
                model_id: modelId,
                prompt_version: promptVersion,
                status,
                total_cases: totalCases,
                passed_cases: passedCases,
                failed_cases: failedCases,
                average_score: averageScore,
                verdict,
                started_at: startedAt,
                completed_at: completedAt,
                triggered_by: triggeredBy,
                metadata,
              });
              return;
            }
            if (sql.startsWith("INSERT INTO eval_case_results")) {
              const [id, runId, caseId, input, expectedOutput, actualOutput, score, passed, latencyMs, metadata] = args;
              caseResults.push({
                id,
                run_id: runId,
                case_id: caseId,
                input,
                expected_output: expectedOutput,
                actual_output: actualOutput,
                score,
                passed,
                latency_ms: latencyMs,
                metadata,
              });
              return;
            }
            if (sql.startsWith("UPDATE eval_runs SET")) {
              const [status, passedCases, failedCases, averageScore, verdict, completedAt, runId] = args;
              const existing = runs.get(String(runId));
              if (existing) {
                runs.set(String(runId), {
                  ...existing,
                  status,
                  passed_cases: passedCases,
                  failed_cases: failedCases,
                  average_score: averageScore,
                  verdict,
                  completed_at: completedAt,
                });
              }
            }
          },
          get(...args: unknown[]) {
            if (sql.startsWith("SELECT * FROM eval_suites WHERE id = ?")) {
              return suites.get(String(args[0]));
            }
            if (sql.startsWith("SELECT * FROM eval_runs WHERE id = ?")) {
              return runs.get(String(args[0]));
            }
            return undefined;
          },
          all(...args: unknown[]) {
            if (sql.startsWith("SELECT * FROM eval_case_results WHERE run_id = ?")) {
              return caseResults.filter((row) => row.run_id === args[0]);
            }
            if (sql.startsWith("SELECT actual_output FROM eval_case_results")) {
              return [...caseResults]
                .sort((left, right) => String(left.actual_output).localeCompare(String(right.actual_output)))
                .map((row) => ({ actual_output: row.actual_output }));
            }
            return [];
          },
        };
      },
    },
  };
}

test("A/B test uses evaluator-provided actual outputs instead of hardcoded placeholders", async () => {
  const db = createInMemoryDb();
  const service = new LlmEvalService(db as never);
  const suite = service.defineSuite({
    name: "ab",
    kind: "ab_test",
    cases: [
      { id: "case-1", input: "hello", expectedOutput: "world" },
      { id: "case-2", input: "foo", expectedOutput: "bar" },
    ],
  });

  const result = await service.runAbTest(suite.id, {
    controlModelId: "model-a",
    treatmentModelId: "model-b",
    controlPromptVersion: "p1",
    treatmentPromptVersion: "p2",
    minSampleSize: 2,
    significanceThreshold: 0.1,
  }, {
    llmEvaluator: {
      async evaluateCase(input) {
        return {
          actualOutput: `${input.arm}:${input.modelId}:${input.promptVersion}:${input.expectedOutput}`,
          score: input.arm === "treatment" ? 1 : 0,
          latencyMs: input.arm === "treatment" ? 90 : 120,
        };
      },
    },
  });

  const rows = db.connection.prepare("SELECT actual_output FROM eval_case_results ORDER BY actual_output").all() as Array<{ actual_output: string }>;
  assert.equal(rows.some((row) => row.actual_output.includes("treatment:model-b:p2:world")), true);
  assert.equal(result.treatmentAvgScore > result.controlAvgScore, true);
  assert.equal(typeof result.pValue, "number");
});
