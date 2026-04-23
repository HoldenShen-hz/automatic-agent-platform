import test from "node:test";
import assert from "node:assert/strict";
import { ExperienceDistillationService } from "../../../../../../src/platform/orchestration/oapeflir/learn/experience-distillation-service.js";
test("ExperienceDistillationService.distill maps signals to learning objects", () => {
    const service = new ExperienceDistillationService();
    const signals = [
        {
            learningSignalId: "sig_1",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "failure_pattern",
            confidence: 0.9,
            valueSummary: "Schema validation failures indicate input format issues",
            evidenceRefs: ["artifact:1"],
            sourceSignalIds: [],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
    ];
    const result = service.distill(signals);
    assert.equal(result.length, 1);
    const first = result[0];
    assert.ok(first != null);
    assert.equal(first.learningType, "failure_pattern");
    assert.equal(first.summary, "Schema validation failures indicate input format issues");
    assert.equal(first.confidence, 0.9);
    assert.ok(first.learningObjectId.startsWith("learning_"));
});
test("ExperienceDistillationService.distill uses recovery_playbook recommendation", () => {
    const service = new ExperienceDistillationService();
    const signals = [
        {
            learningSignalId: "sig_1",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "recovery_playbook",
            confidence: 0.85,
            valueSummary: "Retry with exponential backoff",
            evidenceRefs: [],
            sourceSignalIds: [],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
    ];
    const result = service.distill(signals);
    const first = result[0];
    assert.ok(first != null);
    assert.equal(first.recommendation, "Persist a recovery playbook for the next similar execution.");
});
test("ExperienceDistillationService.distill uses planning recommendation for non-recovery", () => {
    const service = new ExperienceDistillationService();
    const signals = [
        {
            learningSignalId: "sig_1",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "failure_pattern",
            confidence: 0.85,
            valueSummary: "Test signal",
            evidenceRefs: [],
            sourceSignalIds: [],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
    ];
    const result = service.distill(signals);
    const first = result[0];
    assert.ok(first != null);
    assert.equal(first.recommendation, "Convert the observed signal into reusable planning guidance.");
});
test("ExperienceDistillationService.distill preserves evidence refs and source signal IDs", () => {
    const service = new ExperienceDistillationService();
    const signals = [
        {
            learningSignalId: "sig_1",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "user_correction",
            confidence: 0.9,
            valueSummary: "User corrected the prompt",
            evidenceRefs: ["artifact:a", "artifact:b"],
            sourceSignalIds: ["sig_prev"],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
    ];
    const result = service.distill(signals);
    const first = result[0];
    assert.ok(first != null);
    assert.deepEqual(first.evidenceRefs, ["artifact:a", "artifact:b"]);
    assert.deepEqual(first.sourceSignalIds, ["sig_prev"]);
});
test("ExperienceDistillationService.distill sets validatedBy to none and promotionStatus to draft", () => {
    const service = new ExperienceDistillationService();
    const signals = [
        {
            learningSignalId: "sig_1",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "failure_pattern",
            confidence: 0.9,
            valueSummary: "Test",
            evidenceRefs: [],
            sourceSignalIds: [],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
    ];
    const result = service.distill(signals);
    const first = result[0];
    assert.ok(first != null);
    assert.equal(first.validatedBy, "none");
    assert.equal(first.promotionStatus, "draft");
});
test("ExperienceDistillationService.distill maps multiple signals", () => {
    const service = new ExperienceDistillationService();
    const signals = [
        {
            learningSignalId: "sig_1",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "failure_pattern",
            confidence: 0.9,
            valueSummary: "Signal 1",
            evidenceRefs: [],
            sourceSignalIds: [],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
        {
            learningSignalId: "sig_2",
            taskId: "task_1",
            sourceFeedbackId: "feedback_1",
            learningType: "user_correction",
            confidence: 0.8,
            valueSummary: "Signal 2",
            evidenceRefs: [],
            sourceSignalIds: [],
            relatedSignalIds: [],
            evidence: {},
            generatedAt: Date.now(),
        },
    ];
    const result = service.distill(signals);
    assert.equal(result.length, 2);
    const first = result[0];
    const second = result[1];
    assert.ok(first != null);
    assert.ok(second !== undefined);
    assert.equal(first.title, "Distilled failure_pattern");
    assert.equal(second.title, "Distilled user_correction");
});
//# sourceMappingURL=experience-distillation-service.test.js.map