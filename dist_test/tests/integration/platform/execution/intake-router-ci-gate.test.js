import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { LlmEvalService, LLM_EVAL_DDL, } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import { IntakeRouter } from "../../../../src/platform/orchestration/routing/intake-router.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("intake router CI gate evaluates structured intent expectations end-to-end", () => {
    const workspace = createTempWorkspace("aa-intake-router-ci-");
    const dbPath = join(workspace, "intake-router-ci.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.connection.exec(LLM_EVAL_DDL);
        const svc = new LlmEvalService(db);
        const router = new IntakeRouter();
        const suite = svc.defineSuite({
            name: "intake-router-regression-gate",
            kind: "regression",
            description: "Structured CI gate for intent classification and continuation routing.",
            cases: [
                {
                    id: "query-simple",
                    input: JSON.stringify({
                        title: "Need status",
                        request: "What is the current queue status?",
                    }),
                    expectedOutput: JSON.stringify({
                        intent: "query",
                        continuation: "new_task",
                        requiresOrchestration: false,
                        routeReason: "route.simple_request",
                    }),
                },
                {
                    id: "modify-follow-up",
                    input: JSON.stringify({
                        title: "Continue fix",
                        request: "Continue from the previous bug fix plan, update the worker logic, and review the remaining risk.",
                    }),
                    expectedOutput: JSON.stringify({
                        intent: "modify",
                        continuation: "follow_up",
                        requiresOrchestration: true,
                        routeReason: "route.multi_step_or_high_context",
                    }),
                },
                {
                    id: "correction",
                    input: JSON.stringify({
                        title: "Correction",
                        request: "Actually, correct that and change the target environment to staging.",
                    }),
                    expectedOutput: JSON.stringify({
                        intent: "correction",
                        continuation: "correction",
                        requiresOrchestration: false,
                        routeReason: "route.simple_request",
                    }),
                },
            ],
        });
        const gate = svc.runCiGate(suite.id, "rule-router", "v1", {
            evaluator: ({ caseDefinition }) => {
                const input = JSON.parse(caseDefinition.input);
                const expected = JSON.parse(caseDefinition.expectedOutput);
                const decision = router.route(input);
                const actual = {
                    intent: decision.classification.intent,
                    continuation: decision.classification.continuation,
                    requiresOrchestration: decision.requiresOrchestration,
                    routeReason: decision.routeReason,
                };
                const passed = JSON.stringify(actual) === JSON.stringify(expected);
                return {
                    actualOutput: actual,
                    passed,
                    score: passed ? 1 : 0,
                    metadata: {
                        divisionId: decision.divisionId,
                        workflowId: decision.workflowId,
                        confidence: decision.classification.confidence,
                    },
                };
            },
            baselinePromptVersion: null,
        });
        assert.equal(gate.passed, true);
        assert.equal(gate.verdict, "pass");
        assert.deepEqual(gate.regressions, []);
        assert.equal(gate.improvements.length, 3);
        const runs = svc.listRuns(suite.id);
        assert.equal(runs.length, 1);
        assert.equal(runs[0]?.passedCases, 3);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=intake-router-ci-gate.test.js.map