/**
 * @fileoverview Runtime Context Propagation via AsyncLocalStorage.
 *
 * Implements context_propagation_contract.md: provides implicit propagation of
 * task identity, trace, session, and execution context through async call chains
 * without explicit parameter threading.
 *
 * @see Context Propagation Contract: docs_zh/contracts/context_propagation_contract.md
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { ValidationError } from "../../contracts/errors.js";

/**
 * Runtime context snapshot carried implicitly through async execution.
 * Fields align with context_propagation_contract.md §3.
 *
 * Tenant-aware fields (tenantId) enable automatic tenant_id filtering
 * in AuthoritativeTaskStore queries when context is established via provideContext().
 */
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
  /** Tenant identifier for multi-tenant data isolation. When set, enables automatic tenant_id filtering. */
  tenantId?: string | null;
  /** Workspace identifier for workspace-level data scoping. */
  workspaceId?: string | null;
}

const storage = new AsyncLocalStorage<RuntimeContextSnapshot>();

/**
 * Runs a function within an explicit runtime context.
 * This is the sole entry point for establishing context — used by gateway,
 * scheduler, recovery, and approval resume paths.
 */
export function provideContext<T>(snapshot: RuntimeContextSnapshot, fn: () => T | Promise<T>): T | Promise<T> {
  // Call fn() inside storage.run so the context is established for async callbacks too
  return storage.run(snapshot, () => fn());
}

/**
 * Returns the current runtime context.
 * @throws Error if called outside a provideContext scope.
 */
export function getContext(): RuntimeContextSnapshot {
  const ctx = storage.getStore();
  if (ctx == null) {
    throw new ValidationError(
      "runtime_context.missing",
      `runtime_context.missing: getContext() called outside provideContext scope`,
      { details: { function: "getContext" } },
    );
  }
  return ctx;
}

/**
 * Returns the current runtime context, or null if none is active.
 */
export function getContextOrNull(): RuntimeContextSnapshot | null {
  return storage.getStore() ?? null;
}

/**
 * Runs a function with a patched subset of the current context.
 * The patch merges into the existing snapshot — existing fields not in the patch are preserved.
 * @throws Error if called outside a provideContext scope.
 */
export function withContextPatch<T>(patch: Partial<RuntimeContextSnapshot>, fn: () => T): T {
  const current = getContext();
  const merged: RuntimeContextSnapshot = { ...current, ...patch };
  return storage.run(merged, fn);
}

/**
 * Asserts that the current context contains non-null values for all specified keys.
 * @throws Error listing all missing keys if any are absent or null.
 */
export function assertContext(...requiredKeys: (keyof RuntimeContextSnapshot)[]): RuntimeContextSnapshot {
  const ctx = getContext();
  const missing = requiredKeys.filter(
    (key) => ctx[key] == null || ctx[key] === "",
  );
  if (missing.length > 0) {
    throw new ValidationError(
      "runtime_context.missing_fields",
      `Missing required context fields: ${missing.join(", ")}`,
      { details: { missingFields: missing } },
    );
  }
  return ctx;
}

/**
 * Returns the current tenant ID from the runtime context, or null if not set.
 * This is used by AuthoritativeTaskStore query methods to automatically filter by tenant_id
 * when a tenant context has been established via provideContext().
 */
export function getTenantId(): string | null {
  const ctx = storage.getStore();
  return ctx?.tenantId ?? null;
}

/**
 * Returns the current tenant ID from the runtime context, or null if not set.
 * Alias for getTenantId() for semantic clarity in tenant-scoped operations.
 */
export function getTenantIdOrNull(): string | null {
  return getTenantId();
}

/**
 * Returns the current workspace ID from the runtime context, or null if not set.
 * This is used by AuthoritativeTaskStore query methods to automatically filter by workspace_id
 * when a workspace context has been established via provideContext().
 */
export function getWorkspaceId(): string | null {
  const ctx = storage.getStore();
  return ctx?.workspaceId ?? null;
}

/**
 * Returns the current workspace ID from the runtime context, or null if not set.
 * Alias for getWorkspaceId() for semantic clarity in workspace-scoped operations.
 */
export function getWorkspaceIdOrNull(): string | null {
  return getWorkspaceId();
}

/**
 * Checks if the current context has a tenant ID set.
 * Useful for determining whether tenant-aware filtering should be applied.
 */
export function hasTenantContext(): boolean {
  const ctx = storage.getStore();
  return ctx?.tenantId != null && ctx.tenantId !== "";
}

/**
 * Checks if the current context has a workspace ID set.
 * Useful for determining whether workspace-aware filtering should be applied.
 */
export function hasWorkspaceContext(): boolean {
  const ctx = storage.getStore();
  return ctx?.workspaceId != null && ctx.workspaceId !== "";
}
