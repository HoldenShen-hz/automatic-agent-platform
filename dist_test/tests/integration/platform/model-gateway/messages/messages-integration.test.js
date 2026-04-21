import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("User message creation", () => {
    const message = {
        id: newId("msg"),
        role: "user",
        content: "Hello, how are you?",
        tokenCount: 0,
        createdAt: nowIso(),
    };
    assert.ok(message.id.startsWith("msg_"));
    assert.equal(message.role, "user");
    assert.ok(message.content.length > 0);
});
test("Assistant message creation", () => {
    const message = {
        id: newId("msg"),
        role: "assistant",
        content: "I'm doing well, thank you!",
        tokenCount: 0,
        createdAt: nowIso(),
    };
    assert.equal(message.role, "assistant");
});
test("System message creation", () => {
    const message = {
        id: newId("msg"),
        role: "system",
        content: "You are a helpful assistant.",
        tokenCount: 0,
        createdAt: nowIso(),
    };
    assert.equal(message.role, "system");
});
test("Tool message creation", () => {
    const message = {
        id: newId("msg"),
        role: "tool",
        content: '{"result": "file created at /path/to/file.txt"}',
        tokenCount: 0,
        createdAt: nowIso(),
    };
    assert.equal(message.role, "tool");
});
test("Token estimation for short text", () => {
    const text = "Hello world";
    const estimate = {
        text,
        estimatedTokens: Math.ceil(text.length / 4),
        charCount: text.length,
    };
    assert.ok(estimate.estimatedTokens > 0);
    assert.equal(estimate.charCount, 11);
});
test("Token estimation for long text", () => {
    const text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua";
    const estimate = {
        text,
        estimatedTokens: Math.ceil(text.length / 4),
        charCount: text.length,
    };
    assert.ok(estimate.estimatedTokens > estimate.charCount / 6);
    assert.ok(estimate.estimatedTokens < estimate.charCount / 2);
});
test("Conversation message ordering", () => {
    const messages = [
        { id: newId("msg"), role: "system", content: "You are helpful.", tokenCount: 0, createdAt: nowIso() },
        { id: newId("msg"), role: "user", content: "Question one?", tokenCount: 0, createdAt: nowIso() },
        { id: newId("msg"), role: "assistant", content: "Answer one.", tokenCount: 0, createdAt: nowIso() },
        { id: newId("msg"), role: "user", content: "Question two?", tokenCount: 0, createdAt: nowIso() },
    ];
    const sorted = messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    assert.equal(sorted[0]?.role, "system");
    assert.equal(sorted[1]?.role, "user");
    assert.equal(sorted[2]?.role, "assistant");
    assert.equal(sorted[3]?.role, "user");
});
test("Token count accumulation in conversation", () => {
    const messages = [
        { id: newId("msg"), role: "user", content: "Hi", tokenCount: 2, createdAt: nowIso() },
        { id: newId("msg"), role: "assistant", content: "Hello!", tokenCount: 2, createdAt: nowIso() },
        { id: newId("msg"), role: "user", content: "How are you?", tokenCount: 3, createdAt: nowIso() },
    ];
    const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
    assert.equal(totalTokens, 7);
});
test("Token estimation for code content", () => {
    const code = "function hello() {\n  console.log('Hello, World!');\n  return 42;\n}";
    const estimate = {
        text: code,
        estimatedTokens: Math.ceil(code.length / 4),
        charCount: code.length,
    };
    assert.ok(estimate.charCount > 40);
    assert.ok(estimate.estimatedTokens > 10);
});
test("Message role validation", () => {
    const validRoles = ["user", "assistant", "system", "tool"];
    for (const role of validRoles) {
        const message = {
            id: newId("msg"),
            role,
            content: "Test",
            tokenCount: 1,
            createdAt: nowIso(),
        };
        assert.equal(message.role, role);
    }
});
//# sourceMappingURL=messages-integration.test.js.map