import assert from "node:assert/strict";
import test from "node:test";
test("StructuredMemoryFactProvenance structure is correct", () => {
    const provenance = {
        source: "user_input",
        classification: "fact",
        taskId: "task_123",
        sessionId: "sess_456",
        agentId: "agent_789",
        executionId: "exec_abc",
        observedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(provenance.source, "user_input");
    assert.equal(provenance.classification, "fact");
});
test("StructuredMemoryFactProvenance allows null fields", () => {
    const provenance = {
        source: "default",
        classification: null,
        taskId: null,
        sessionId: null,
        agentId: null,
        executionId: null,
        observedAt: null,
    };
    assert.equal(provenance.classification, null);
    assert.equal(provenance.taskId, null);
});
test("StructuredMemoryFact structure is correct", () => {
    const fact = {
        content: "The user prefers dark mode",
        category: "preference",
        confidence: 0.95,
        provenance: {
            source: "user_input",
            classification: "preference",
            taskId: "task_123",
            sessionId: "sess_456",
            agentId: null,
            executionId: null,
            observedAt: "2026-04-14T00:00:00.000Z",
        },
    };
    assert.equal(fact.content, "The user prefers dark mode");
    assert.equal(fact.category, "preference");
    assert.equal(fact.confidence, 0.95);
});
test("StructuredMemoryFact allows null category and confidence", () => {
    const fact = {
        content: "Something happened",
        category: null,
        confidence: null,
        provenance: {
            source: "system",
            classification: null,
            taskId: null,
            sessionId: null,
            agentId: null,
            executionId: null,
            observedAt: null,
        },
    };
    assert.equal(fact.category, null);
    assert.equal(fact.confidence, null);
});
test("StructuredMemoryContent structure is correct", () => {
    const content = {
        schemaVersion: "memory.v2",
        workContext: "Working on project X",
        topOfMind: ["urgent task", "deadline tomorrow"],
        recentHistory: ["completed feature A", "reviewed PR #123"],
        longTermBackground: ["Project X started in 2025", "Main language is TypeScript"],
        facts: [
            {
                content: "User prefers dark mode",
                category: "preference",
                confidence: 0.95,
                provenance: {
                    source: "user_input",
                    classification: "preference",
                    taskId: "task_123",
                    sessionId: null,
                    agentId: null,
                    executionId: null,
                    observedAt: null,
                },
            },
        ],
    };
    assert.equal(content.schemaVersion, "memory.v2");
    assert.equal(content.workContext, "Working on project X");
    assert.equal(content.facts.length, 1);
});
test("StructuredMemoryContent allows empty arrays", () => {
    const content = {
        schemaVersion: "memory.v2",
        workContext: null,
        topOfMind: [],
        recentHistory: [],
        longTermBackground: [],
        facts: [],
    };
    assert.equal(content.workContext, null);
    assert.equal(content.topOfMind.length, 0);
    assert.equal(content.facts.length, 0);
});
test("StructuredMemoryContent facts can contain multiple items", () => {
    const content = {
        schemaVersion: "memory.v2",
        workContext: "Multiple facts",
        topOfMind: ["fact1", "fact2"],
        recentHistory: [],
        longTermBackground: [],
        facts: [
            {
                content: "Fact 1",
                category: "fact",
                confidence: 0.9,
                provenance: {
                    source: "src1",
                    classification: null,
                    taskId: null,
                    sessionId: null,
                    agentId: null,
                    executionId: null,
                    observedAt: null,
                },
            },
            {
                content: "Fact 2",
                category: "rule",
                confidence: 0.8,
                provenance: {
                    source: "src2",
                    classification: null,
                    taskId: null,
                    sessionId: null,
                    agentId: null,
                    executionId: null,
                    observedAt: null,
                },
            },
        ],
    };
    assert.equal(content.facts.length, 2);
    assert.equal(content.facts[0]?.content, "Fact 1");
    assert.equal(content.facts[1]?.content, "Fact 2");
});
test("NormalizeMemoryContentInput structure with string content", () => {
    const input = {
        content: "Simple text content",
    };
    assert.equal(input.content, "Simple text content");
});
test("NormalizeMemoryContentInput structure with Record content", () => {
    const input = {
        content: { key: "value", nested: { data: true } },
        classification: "fact",
        qualityScore: 0.85,
    };
    assert.deepEqual(input.content, { key: "value", nested: { data: true } });
    assert.equal(input.classification, "fact");
    assert.equal(input.qualityScore, 0.85);
});
test("NormalizeMemoryContentInput structure with StructuredMemoryContent", () => {
    const structured = {
        schemaVersion: "memory.v2",
        workContext: "Structured content",
        topOfMind: [],
        recentHistory: [],
        longTermBackground: [],
        facts: [],
    };
    const input = {
        content: structured,
        classification: "work_context",
        qualityScore: 0.9,
        taskId: "task_abc",
        sessionId: "sess_xyz",
    };
    const typedContent = input.content;
    assert.equal(typedContent.schemaVersion, "memory.v2");
    assert.equal(input.taskId, "task_abc");
});
test("NormalizeMemoryContentInput allows null optional fields", () => {
    const input = {
        content: "Content",
        classification: null,
        qualityScore: null,
        taskId: null,
        sessionId: null,
        agentId: null,
        executionId: null,
        observedAt: null,
    };
    assert.equal(input.classification, null);
    assert.equal(input.qualityScore, null);
});
test("NormalizeMemoryContentInput allows defaultSource", () => {
    const input = {
        content: "Content with source",
        defaultSource: "custom_source",
    };
    assert.equal(input.defaultSource, "custom_source");
});
//# sourceMappingURL=memory-schema-types.test.js.map