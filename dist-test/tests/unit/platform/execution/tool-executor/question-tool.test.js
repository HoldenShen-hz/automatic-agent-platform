import assert from "node:assert/strict";
import test from "node:test";
import { validateQuestionRequest, normalizeAnswer, getAnswerLabel, QuestionToolService, } from "../../../../../src/platform/execution/tool-executor/question-tool.js";
const createMockRequest = (overrides = {}) => ({
    callId: "call_123",
    toolName: "question",
    ...overrides,
});
const createOption = (id, label, isDefault) => ({
    optionId: id,
    label,
    isDefault: isDefault ?? null,
});
test("validateQuestionRequest accepts valid single choice request", () => {
    const request = createMockRequest({
        question: "What is your favorite color?",
        questionType: "single_choice",
        options: [createOption("opt1", "Red"), createOption("opt2", "Blue")],
    });
    assert.equal(validateQuestionRequest(request).valid, true);
});
test("validateQuestionRequest accepts valid multiple choice request", () => {
    const request = createMockRequest({
        question: "Select your interests?",
        questionType: "multiple_choice",
        options: [createOption("opt1", "Sports"), createOption("opt2", "Music")],
    });
    assert.equal(validateQuestionRequest(request).valid, true);
});
test("validateQuestionRequest rejects empty question", () => {
    const request = createMockRequest({
        question: "   ",
        questionType: "single_choice",
        options: [createOption("opt1", "Red")],
    });
    const result = validateQuestionRequest(request);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Question text"));
});
test("validateQuestionRequest rejects missing question", () => {
    const request = createMockRequest({
        question: "",
        questionType: "single_choice",
        options: [createOption("opt1", "Red")],
    });
    // @ts-expect-error - testing with empty string
    delete request.question;
    const result = validateQuestionRequest(request);
    assert.equal(result.valid, false);
});
test("validateQuestionRequest rejects empty options", () => {
    const request = createMockRequest({
        question: "What is your favorite?",
        questionType: "single_choice",
        options: [],
    });
    const result = validateQuestionRequest(request);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("At least one option"));
});
test("validateQuestionRequest rejects option without ID", () => {
    const request = createMockRequest({
        question: "What is your favorite?",
        questionType: "single_choice",
        options: [{ optionId: "", label: "Option 1" }],
    });
    const result = validateQuestionRequest(request);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Option ID"));
});
test("validateQuestionRequest rejects option without label", () => {
    const request = createMockRequest({
        question: "What is your favorite?",
        questionType: "single_choice",
        options: [{ optionId: "opt1", label: "" }],
    });
    const result = validateQuestionRequest(request);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Option label"));
});
test("validateQuestionRequest rejects single choice with multiple defaults", () => {
    const request = createMockRequest({
        question: "What is your favorite?",
        questionType: "single_choice",
        options: [
            createOption("opt1", "Red", true),
            createOption("opt2", "Blue", true),
        ],
    });
    const result = validateQuestionRequest(request);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("only have one default"));
});
test("validateQuestionRequest allows single choice with one default", () => {
    const request = createMockRequest({
        question: "What is your favorite?",
        questionType: "single_choice",
        options: [
            createOption("opt1", "Red", true),
            createOption("opt2", "Blue"),
        ],
    });
    assert.equal(validateQuestionRequest(request).valid, true);
});
test("validateQuestionRequest allows multiple choice with multiple defaults", () => {
    const request = createMockRequest({
        question: "Select your interests?",
        questionType: "multiple_choice",
        options: [
            createOption("opt1", "Sports", true),
            createOption("opt2", "Music", true),
        ],
    });
    assert.equal(validateQuestionRequest(request).valid, true);
});
test("normalizeAnswer returns null as-is", () => {
    assert.equal(normalizeAnswer(null, "single_choice"), null);
    assert.equal(normalizeAnswer(null, "multiple_choice"), null);
    assert.equal(normalizeAnswer(null, "skippable"), null);
});
test("normalizeAnswer handles single choice with string answer", () => {
    const result = normalizeAnswer("opt1", "single_choice");
    assert.equal(result, "opt1");
});
test("normalizeAnswer handles single choice with array answer (takes first)", () => {
    const result = normalizeAnswer(["opt1", "opt2"], "single_choice");
    assert.equal(result, "opt1");
});
test("normalizeAnswer handles single choice with empty array", () => {
    const result = normalizeAnswer([], "single_choice");
    assert.equal(result, null);
});
test("normalizeAnswer handles multiple choice with array answer (dedupes)", () => {
    const result = normalizeAnswer(["opt1", "opt2", "opt1"], "multiple_choice");
    assert.deepEqual(result, ["opt1", "opt2"]);
});
test("normalizeAnswer handles multiple choice with string answer (wraps in array)", () => {
    const result = normalizeAnswer("opt1", "multiple_choice");
    assert.deepEqual(result, ["opt1"]);
});
test("normalizeAnswer passes through for skippable", () => {
    const result = normalizeAnswer("any-answer", "skippable");
    assert.equal(result, "any-answer");
});
test("getAnswerLabel returns null for null answer", () => {
    const options = [createOption("opt1", "Red"), createOption("opt2", "Blue")];
    assert.equal(getAnswerLabel(null, options), null);
});
test("getAnswerLabel returns label for single answer", () => {
    const options = [createOption("opt1", "Red"), createOption("opt2", "Blue")];
    assert.equal(getAnswerLabel("opt1", options), "Red");
    assert.equal(getAnswerLabel("opt2", options), "Blue");
});
test("getAnswerLabel returns null for unknown option ID", () => {
    const options = [createOption("opt1", "Red")];
    assert.equal(getAnswerLabel("unknown", options), null);
});
test("getAnswerLabel returns joined labels for array answer", () => {
    const options = [
        createOption("opt1", "Red"),
        createOption("opt2", "Blue"),
        createOption("opt3", "Green"),
    ];
    assert.equal(getAnswerLabel(["opt1", "opt3"], options), "Red, Green");
});
test("getAnswerLabel filters unknown option IDs", () => {
    const options = [createOption("opt1", "Red")];
    assert.equal(getAnswerLabel(["opt1", "unknown"], options), "Red");
});
test("QuestionToolService.createQuestion creates valid question", () => {
    const service = new QuestionToolService();
    const request = createMockRequest({
        question: "What is your favorite color?",
        questionType: "single_choice",
        options: [createOption("red", "Red"), createOption("blue", "Blue")],
        context: "User preference survey",
    });
    const result = service.createQuestion(request);
    assert.equal(result.questionId, "q_call_123");
    assert.equal(result.metadata.questionType, "single_choice");
    assert.equal(result.metadata.optionsCount, 2);
    assert.equal(result.renderable.question, "What is your favorite color?");
    assert.equal(result.renderable.options.length, 2);
    assert.equal(result.renderable.context, "User preference survey");
});
test("QuestionToolService.createQuestion uses default timeout of 5 minutes", () => {
    const service = new QuestionToolService();
    const request = createMockRequest({
        question: "What is your favorite?",
        questionType: "single_choice",
        options: [createOption("opt1", "Option 1")],
    });
    const result = service.createQuestion(request);
    assert.equal(result.metadata.timeoutMs, 300000);
});
test("QuestionToolService.createQuestion throws for invalid request", () => {
    const service = new QuestionToolService();
    const request = createMockRequest({
        question: "",
        questionType: "single_choice",
        options: [],
    });
    assert.throws(() => service.createQuestion(request), (e) => e.code === "question.invalid_request");
});
test("QuestionToolService.validateAnswer accepts null answer", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer(null, "single_choice", new Set(["opt1"]));
    assert.equal(result.valid, true);
});
test("QuestionToolService.validateAnswer accepts valid single choice", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer("opt1", "single_choice", new Set(["opt1", "opt2"]));
    assert.equal(result.valid, true);
});
test("QuestionToolService.validateAnswer rejects array for single choice", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer(["opt1"], "single_choice", new Set(["opt1"]));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Single choice"));
});
test("QuestionToolService.validateAnswer rejects unknown option for single choice", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer("unknown", "single_choice", new Set(["opt1"]));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Invalid option ID"));
});
test("QuestionToolService.validateAnswer accepts valid multiple choice", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer(["opt1", "opt2"], "multiple_choice", new Set(["opt1", "opt2"]));
    assert.equal(result.valid, true);
});
test("QuestionToolService.validateAnswer rejects string for multiple choice", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer("opt1", "multiple_choice", new Set(["opt1"]));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Multiple choice"));
});
test("QuestionToolService.validateAnswer rejects unknown option for multiple choice", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer(["opt1", "unknown"], "multiple_choice", new Set(["opt1"]));
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Invalid option ID"));
});
test("QuestionToolService.validateAnswer accepts any answer for skippable", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer("anything", "skippable", new Set());
    assert.equal(result.valid, true);
});
test("QuestionToolService.validateAnswer accepts array for skippable", () => {
    const service = new QuestionToolService();
    const result = service.validateAnswer(["any", "thing"], "skippable", new Set());
    assert.equal(result.valid, true);
});
//# sourceMappingURL=question-tool.test.js.map