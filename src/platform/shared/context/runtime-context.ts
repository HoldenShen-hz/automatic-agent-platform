/**
 * @fileoverview Runtime Context Propagation via AsyncLocalStorage.
 *
 * Shared context propagation lives under platform/shared so interface, control,
 * execution, and state/evidence planes can depend on the same context contract
 * without introducing reverse dependencies on execution-specific modules.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { ValidationError } from "../../contracts/errors.js";

export interface RuntimeContextSnapshot {
  traceId: string;
  spanId?: string | null;
  parentSpanId?: string | null;
  taskId: string;
  executionId?: string | null;
  workflowId?: string | null;
  sessionId?: string | null;
  agentId?: string | null;
  divisionId?: string | null;
  workdir?: string | null;
  requestId?: string | null;
  approvalId?: string | null;
  abortSignalRef?: string | null;
  budgetScopeId?: string | null;
  tenantId?: string | null;
  workspaceId?: string | null;
}

const storage = new AsyncLocalStorage<RuntimeContextSnapshot>();

export function provideContext<T>(snapshot: RuntimeContextSnapshot, fn: () => T | Promise<T>): T | Promise<T> {
  return storage.run(snapshot, () => fn());
}

export function getContext(): RuntimeContextSnapshot {
  const ctx = storage.getStore();
  if (ctx == null) {
    throw new ValidationError(
      "runtime_context.missing",
      "runtime_context.missing: getContext() called outside provideContext scope",
      { details: { function: "getContext" } },
    );
  }
  return ctx;
}

export function getContextOrNull(): RuntimeContextSnapshot | null {
  return storage.getStore() ?? null;
}

export function withContextPatch<T>(patch: Partial<RuntimeContextSnapshot>, fn: () => T): T {
  const current = getContext();
  return storage.run({ ...current, ...patch }, fn);
}

export function assertContext(...requiredKeys: (keyof RuntimeContextSnapshot)[]): RuntimeContextSnapshot {
  const ctx = getContext();
  const missing = requiredKeys.filter((key) => ctx[key] == null || ctx[key] === "");
  if (missing.length > 0) {
    throw new ValidationError(
      "runtime_context.missing_fields",
      `Missing required context fields: ${missing.join(", ")}`,
      { details: { missingFields: missing } },
    );
  }
  return ctx;
}

export function getTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

export function getTenantIdOrNull(): string | null {
  return getTenantId();
}

export function getWorkspaceId(): string | null {
  return storage.getStore()?.workspaceId ?? null;
}

export function getWorkspaceIdOrNull(): string | null {
  return getWorkspaceId();
}

export function hasTenantContext(): boolean {
  const ctx = storage.getStore();
  return ctx?.tenantId != null && ctx.tenantId !== "";
}

export function hasWorkspaceContext(): boolean {
  const ctx = storage.getStore();
  return ctx?.workspaceId != null && ctx.workspaceId !== "";
}
