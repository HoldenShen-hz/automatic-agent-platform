import test from "node:test";
import assert from "node:assert/strict";
import { OapeflirLoopService } from "../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
test("OapeflirLoopService closes OAPEFLIR shadow loop for repairable execution", async () => {
    const service = new OapeflirLoopService();
    const result = await service.run({
        taskId: "task_1",
        objective: "repair failing workflow",
        workflow: {
            workflow: {
                workflowId: "wf_loop",
                divisionId: "coding",
                steps: [],
            },
            executionSteps: [
                {
                    stepId: "step_observe",
                    divisionId: "coding",
                    roleId: "planner",
                    inputKeys: [],
                    agentId: "agent_planner",
                    outputKey: "plan",
                    outputSchemaPath: null,
                    dependsOnStepIds: [],
                    dependencyTypes: {},
                    timeoutMs: 1000,
                    maxAttempts: 1,
                },
            ],
            planReason: "workflow.single_step_execution",
            dependencyEdges: [],
        },
        fileRefs: ["src/foo.ts"],
        feedbackSignals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_1",
                category: "correction",
                severity: "warning",
                payload: {
                    summary: "validation requested narrower diff",
                    reasonCode: "validation.repair_required",
                    durationMs: 30,
                },
                stepOutputRefs: ["step_observe"],
                timestamp: Date.now(),
            },
        ],
    });
    assert.equal(result.plan.taskId, "task_1");
    assert.equal(result.feedback.outcome, "repairable");
    assert.equal(result.qualityGate.releaseStage, "repair");
    assert.equal(result.replanDecision.shouldReplan, true);
    assert.equal(result.learningSignals.length, 1);
    assert.equal(result.rolloutRecord?.level, "shadow");
    assert.deepEqual(result.timeline.map((entry) => entry.stage), ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"]);
    assert.equal(result.timeline.every((entry, index, items) => index === 0 || entry.startedAt > items[index - 1].startedAt), true);
});
//# sourceMappingURL=oapeflir-loop.test.js.map