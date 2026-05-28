import type { RuntimeContextSnapshot } from "../../shared/context/runtime-context.js";

export interface MiddlewareResult {
  success: boolean;
  input?: unknown;
  error?: {
    code: string;
    message: string;
    warning?: boolean;
  };
  continueOnError?: boolean;
}

export interface MiddlewareContext {
  runtime: RuntimeContextSnapshot;
  chainStartedAt: string;
  agentRound: number;
  stepId: string | null;
  executionId: string | null;
  taskId: string;
}

export interface MiddlewareHook {
  name: string;
  priority: number;
}

export interface BeforeAgentHook extends MiddlewareHook {
  run(ctx: MiddlewareContext, input: { request: string; history: unknown[] }): MiddlewareResult | Promise<MiddlewareResult>;
}

export interface BeforeModelHook extends MiddlewareHook {
  run(ctx: MiddlewareContext, input: { messages: unknown[]; model?: string }): MiddlewareResult | Promise<MiddlewareResult>;
}

export interface AfterModelHook extends MiddlewareHook {
  run(ctx: MiddlewareContext, input: { messages: unknown[]; response: unknown }): MiddlewareResult | Promise<MiddlewareResult>;
}

export interface WrapModelCallHook extends MiddlewareHook {
  run<T>(
    ctx: MiddlewareContext,
    input: { messages: unknown[]; model?: string },
    next: () => Promise<T>,
  ): Promise<T>;
}

export interface WrapToolCallHook extends MiddlewareHook {
  run<T>(
    ctx: MiddlewareContext,
    input: { toolName: string; args: Record<string, unknown> },
    next: () => Promise<T>,
  ): Promise<T>;
}

export interface AfterAgentHook extends MiddlewareHook {
  run(ctx: MiddlewareContext, input: { response: unknown; toolsUsed: string[] }): MiddlewareResult | Promise<MiddlewareResult>;
}

export interface OnSucceededPayload {
  taskId: string;
  executionId: string;
  output: unknown;
  durationMs: number;
}

export interface OnFailedPayload {
  taskId: string;
  executionId: string;
  errorCode: string;
  errorMessage: string;
  durationMs: number;
}

export interface OnSucceededHook extends MiddlewareHook {
  run(payload: OnSucceededPayload): void | Promise<void>;
}

export interface OnFailedHook extends MiddlewareHook {
  run(payload: OnFailedPayload): void | Promise<void>;
}
