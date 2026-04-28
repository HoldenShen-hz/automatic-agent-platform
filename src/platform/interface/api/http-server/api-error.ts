/**
 * @fileoverview HTTP API error class and error normalization.
 *
 * Extracted from http-api-server.ts as part of GAP24A-02 deep split.
 */

import { AppError, type AppErrorCategory, type AppErrorSource } from "../../../contracts/errors.js";
import {
  GatewayTargetAmbiguousError,
  GatewayTargetNotFoundError,
} from "../../channel-gateway/gateway-target-directory-service.js";
import { GatewayRateLimitError } from "../../channel-gateway/channel-gateway-service.js";

export class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: inferApiErrorCategory(statusCode, code),
      source: inferApiErrorSource(code),
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export function inferApiErrorCategory(statusCode: number, code: string): AppErrorCategory {
  if (code.startsWith("api.tenant_")) {
    return "tenant";
  }
  if (code.startsWith("approval.")) {
    return "policy";
  }
  if (code.startsWith("gateway.")) {
    if (statusCode === 429 || statusCode >= 500) {
      return "external";
    }
    return statusCode >= 400 && statusCode < 500 ? "validation" : "external";
  }
  if (statusCode === 400) {
    return "validation";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "auth";
  }
  if (statusCode === 404 || statusCode === 409) {
    return "workflow";
  }
  return statusCode >= 500 ? "internal" : "validation";
}

export function inferApiErrorSource(code: string): AppErrorSource {
  if (code.startsWith("gateway.")) {
    return "gateway";
  }
  if (code.startsWith("approval.")) {
    return "policy";
  }
  return "runtime";
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof GatewayRateLimitError) {
    return new ApiError(429, "gateway.rate_limited", `Gateway channel ${error.channel} exceeded rate limits.`);
  }
  if (error instanceof AppError) {
    if (error.code === "storage.task_not_found") {
      return new ApiError(404, "api.task_not_found", "Task not found.");
    }
    if (error.code === "storage.workflow_not_found") {
      return new ApiError(404, "api.workflow_not_found", "Workflow not found.");
    }
    if (error.code === "workflow.not_found") {
      return new ApiError(404, "api.workflow_not_found", "Workflow not found.");
    }
    return error;
  }
  if (error instanceof GatewayTargetNotFoundError) {
    return new ApiError(404, "gateway.target_not_found", "Gateway target not found.");
  }
  if (error instanceof GatewayTargetAmbiguousError) {
    return new ApiError(409, "gateway.target_ambiguous", "Gateway target query is ambiguous.");
  }
  if (error instanceof Error) {
    if (error.message === "workflow.not_found") {
      return new ApiError(404, "api.workflow_not_found", "Workflow not found.");
    }
    if (error.message.startsWith("Task not found:")) {
      return new ApiError(404, "api.task_not_found", "Task not found.");
    }
    if (error.message === "approval.not_found") {
      return new ApiError(404, "approval.not_found", "Approval not found.");
    }
    return new ApiError(500, "api.internal_error", "Internal server error.");
  }
  return new ApiError(500, "api.unknown_error", "Unknown API error.");
}
