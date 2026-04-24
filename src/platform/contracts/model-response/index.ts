import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export interface ModelResponse {
  responseId: string;
  requestId: string;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "content_filter" | "tool_use" | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  tenantId: string | null;
  taskId: string | null;
  createdAt: string;
}

export function createModelResponse(input: Omit<ModelResponse, "responseId" | "createdAt"> & {
  responseId?: string;
  createdAt?: string;
}): ModelResponse {
  if (input.requestId.trim().length === 0) {
    throw new ValidationError("model_response.request_id_required", "Model response requires a request ID.");
  }
  if (input.model.trim().length === 0) {
    throw new ValidationError("model_response.model_required", "Model response requires a model id.");
  }
  if (input.content.trim().length === 0) {
    throw new ValidationError("model_response.content_required", "Model response requires content.");
  }
  return {
    responseId: input.responseId ?? newId("modelresp"),
    requestId: input.requestId,
    model: input.model,
    content: input.content,
    finishReason: input.finishReason ?? null,
    usage: input.usage ?? null,
    tenantId: input.tenantId ?? null,
    taskId: input.taskId ?? null,
    createdAt: input.createdAt ?? nowIso(),
  };
}
