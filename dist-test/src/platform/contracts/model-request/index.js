import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
export function createModelRequest(input) {
    if (input.model.trim().length === 0) {
        throw new ValidationError("model_request.model_required", "Model request requires a model id.");
    }
    if (input.messages.length === 0) {
        throw new ValidationError("model_request.messages_required", "Model request requires at least one message.");
    }
    return {
        requestId: input.requestId ?? newId("modelreq"),
        model: input.model,
        messages: input.messages.map((message) => {
            if (message.content.trim().length === 0) {
                throw new ValidationError("model_request.message_content_required", "Model request messages require content.");
            }
            return { ...message };
        }),
        temperature: input.temperature ?? null,
        maxTokens: input.maxTokens ?? null,
        tenantId: input.tenantId ?? null,
        taskId: input.taskId ?? null,
        createdAt: input.createdAt ?? nowIso(),
    };
}
//# sourceMappingURL=index.js.map