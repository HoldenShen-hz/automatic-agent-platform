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
const storage = new AsyncLocalStorage();
/**
 * Runs a function within an explicit runtime context.
 * This is the sole entry point for establishing context — used by gateway,
 * scheduler, recovery, and approval resume paths.
 */
export function provideContext(snapshot, fn) {
    // Call fn() inside storage.run so the context is established for async callbacks too
    return storage.run(snapshot, () => fn());
}
/**
 * Returns the current runtime context.
 * @throws Error if called outside a provideContext scope.
 */
export function getContext() {
    const ctx = storage.getStore();
    if (ctx == null) {
        throw new ValidationError("runtime_context.missing", `runtime_context.missing: getContext() called outside provideContext scope`, { details: { function: "getContext" } });
    }
    return ctx;
}
/**
 * Returns the current runtime context, or null if none is active.
 */
export function getContextOrNull() {
    return storage.getStore() ?? null;
}
/**
 * Runs a function with a patched subset of the current context.
 * The patch merges into the existing snapshot — existing fields not in the patch are preserved.
 * @throws Error if called outside a provideContext scope.
 */
export function withContextPatch(patch, fn) {
    const current = getContext();
    const merged = { ...current, ...patch };
    return storage.run(merged, fn);
}
/**
 * Asserts that the current context contains non-null values for all specified keys.
 * @throws Error listing all missing keys if any are absent or null.
 */
export function assertContext(...requiredKeys) {
    const ctx = getContext();
    const missing = requiredKeys.filter((key) => ctx[key] == null || ctx[key] === "");
    if (missing.length > 0) {
        throw new ValidationError("runtime_context.missing_fields", `Missing required context fields: ${missing.join(", ")}`, { details: { missingFields: missing } });
    }
    return ctx;
}
/**
 * Returns the current tenant ID from the runtime context, or null if not set.
 * This is used by AuthoritativeTaskStore query methods to automatically filter by tenant_id
 * when a tenant context has been established via provideContext().
 */
export function getTenantId() {
    const ctx = storage.getStore();
    return ctx?.tenantId ?? null;
}
/**
 * Returns the current tenant ID from the runtime context, or null if not set.
 * Alias for getTenantId() for semantic clarity in tenant-scoped operations.
 */
export function getTenantIdOrNull() {
    return getTenantId();
}
/**
 * Returns the current workspace ID from the runtime context, or null if not set.
 * This is used by AuthoritativeTaskStore query methods to automatically filter by workspace_id
 * when a workspace context has been established via provideContext().
 */
export function getWorkspaceId() {
    const ctx = storage.getStore();
    return ctx?.workspaceId ?? null;
}
/**
 * Returns the current workspace ID from the runtime context, or null if not set.
 * Alias for getWorkspaceId() for semantic clarity in workspace-scoped operations.
 */
export function getWorkspaceIdOrNull() {
    return getWorkspaceId();
}
/**
 * Checks if the current context has a tenant ID set.
 * Useful for determining whether tenant-aware filtering should be applied.
 */
export function hasTenantContext() {
    const ctx = storage.getStore();
    return ctx?.tenantId != null && ctx.tenantId !== "";
}
/**
 * Checks if the current context has a workspace ID set.
 * Useful for determining whether workspace-aware filtering should be applied.
 */
export function hasWorkspaceContext() {
    const ctx = storage.getStore();
    return ctx?.workspaceId != null && ctx.workspaceId !== "";
}
//# sourceMappingURL=runtime-context.js.map