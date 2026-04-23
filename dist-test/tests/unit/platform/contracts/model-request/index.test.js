import assert from "node:assert/strict";
import test from "node:test";
import { createModelRequest } from "../../../../../src/platform/contracts/model-request/index.js";
test("ModelMessage accepts canonical model chat roles", () => {
    const messages = [
        { role: "system", content: "You are a reviewer." },
        { role: "user", content: "Review this deployment." },
    ];
    assert.equal(messages.length, 2);
});
test("createModelRequest builds a minimal model request envelope", () => {
    const request = createModelRequest({
        model: "gpt-5.4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.2,
        maxTokens: 512,
        tenantId: "tenant-1",
        taskId: "task-1",
    });
    assert.equal(request.model, "gpt-5.4");
    assert.equal(request.messages[0]?.role, "user");
});
//# sourceMappingURL=index.test.js.map