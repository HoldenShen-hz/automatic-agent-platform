/**
 * @fileoverview Runtime Context Propagation via AsyncLocalStorage.
 *
 * Shared context propagation lives under platform/shared so interface, control,
 * execution, and state/evidence planes can depend on the same context contract
 * without introducing reverse dependencies on execution-specific modules.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { ValidationError } from "../../contracts/errors.js";
const storage = new AsyncLocalStorage();
export function provideContext(snapshot, fn) {
    return storage.run(snapshot, () => fn());
}
export function getContext() {
    const ctx = storage.getStore();
    if (ctx == null) {
        throw new ValidationError("runtime_context.missing", "runtime_context.missing: getContext() called outside provideContext scope", { details: { function: "getContext" } });
    }
    return ctx;
}
export function getContextOrNull() {
    return storage.getStore() ?? null;
}
export function withContextPatch(patch, fn) {
    const current = getContext();
    return storage.run({ ...current, ...patch }, fn);
}
export function assertContext(...requiredKeys) {
    const ctx = getContext();
    const missing = requiredKeys.filter((key) => ctx[key] == null || ctx[key] === "");
    if (missing.length > 0) {
        throw new ValidationError("runtime_context.missing_fields", `Missing required context fields: ${missing.join(", ")}`, { details: { missingFields: missing } });
    }
    return ctx;
}
export function getTenantId() {
    return storage.getStore()?.tenantId ?? null;
}
export function getTenantIdOrNull() {
    return getTenantId();
}
export function getWorkspaceId() {
    return storage.getStore()?.workspaceId ?? null;
}
export function getWorkspaceIdOrNull() {
    return getWorkspaceId();
}
export function hasTenantContext() {
    const ctx = storage.getStore();
    return ctx?.tenantId != null && ctx.tenantId !== "";
}
export function hasWorkspaceContext() {
    const ctx = storage.getStore();
    return ctx?.workspaceId != null && ctx.workspaceId !== "";
}
//# sourceMappingURL=runtime-context.js.map