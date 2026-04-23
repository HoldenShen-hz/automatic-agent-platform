import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { LLM_EVAL_DDL, LlmEvalService, } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import { PROMPT_MODEL_POLICY_GOVERNANCE_DDL, PromptModelPolicyGovernanceService, } from "../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-service.js";
import { IntakeRouter } from "../../../../src/platform/orchestration/routing/intake-router.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("prompt-model-policy governance integrates structured intent evaluation into prompt promotion", () => {
    const workspace = createTempWorkspace("aa-governance-integration-");
    const dbPath = join(workspace, "governance-integration.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.connection.exec(LLM_EVAL_DDL);
        db.connection.exec(PROMPT_MODEL_POLICY_GOVERNANCE_DDL);
        const evalService = new LlmEvalService(db);
        const governance = new PromptModelPolicyGovernanceService(db, evalService);
        const router = new IntakeRouter();
        const suite = evalService.defineSuite({
            name: "prompt-intent-governance-gate",
            kind: "regression",
            cases: [
                {
                    id: "query",
                    input: JSON.stringify({
                        title: "Need status",
                        request: "What is the current deployment status?",
                    }),
                    expectedOutput: JSON.stringify({
                        intent: "query",
                        continuation: "new_task",
                    }),
                },
                {
                    id: "follow-up",
                    input: JSON.stringify({
                        title: "Continue",
                        request: "Continue from the previous rollout plan and review the remaining risks.",
                    }),
                    expectedOutput: JSON.stringify({
                        intent: "query",
                        continuation: "follow_up",
                    }),
                },
            ],
        });
        const release = governance.registerPromptRelease({
            promptKey: "intake.router.system",
            version: "prompt.intent.v1",
            owner: "ops.ai",
            reviewRequired: false,
            rolloutScope: "canary",
            evaluationSuiteId: suite.id,
            rollbackVersion: "prompt.intent.v0",
        });
        const result = governance.evaluateReleaseGate({
            releaseId: release.id,
            modelId: "rule-router",
            promptVersion: "prompt.intent.v1",
            promoteTo: "active",
            evaluator: ({ caseDefinition }) => {
                const input = JSON.parse(caseDefinition.input);
                const expected = JSON.parse(caseDefinition.expectedOutput);
                const actual = router.route(input).classification;
                const passed = actual.intent === expected.intent
                    && actual.continuation === expected.continuation;
                return {
                    actualOutput: {
                        intent: actual.intent,
                        continuation: actual.continuation,
                        confidence: actual.confidence,
                    },
                    passed,
                    score: passed ? 1 : 0,
                };
            },
        });
        assert.equal(result.gate.passed, true);
        assert.equal(result.release.status, "active");
        assert.equal(governance.listGateEvents(release.id).length, 1);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=prompt-model-policy-governance.test.js.map