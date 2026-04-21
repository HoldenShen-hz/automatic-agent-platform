/**
 * Exception Recovery Configuration Types
 *
 * Defines the types for the configurable exception recovery strategy table.
 * The configuration is loaded from config/exception-recovery/default.json.
 */
/**
 * Maps error class names to exception types for strategy lookup.
 */
export const ERROR_CLASS_TO_EXCEPTION_TYPE = {
    ValidationError: "validation_error",
    PolicyDeniedError: "policy_denied",
    AuthError: "auth_error",
    TransientExternalError: "transient_external_error",
    PermanentExternalError: "permanent_external_error",
    ProviderError: "provider_error",
    ToolExecutionError: "tool_execution_error",
    SandboxError: "sandbox_error",
    StorageError: "storage_error",
    WorkflowStateError: "workflow_state_error",
    TenantBoundaryError: "tenant_boundary_error",
    MonetizationError: "monetization_error",
    InternalAppError: "internal_error",
    LockingError: "locking_error",
    MemoryError: "memory_error",
    RuntimeError: "runtime_error",
};
/**
 * Maps AppError category to exception type for strategy lookup.
 */
export const CATEGORY_TO_EXCEPTION_TYPE = {
    validation: "validation_error",
    policy: "policy_denied",
    auth: "auth_error",
    provider: "provider_error",
    tool: "tool_execution_error",
    sandbox: "sandbox_error",
    storage: "storage_error",
    workflow: "workflow_state_error",
    tenant: "tenant_boundary_error",
    monetization: "monetization_error",
    external: "unknown_error",
    internal: "internal_error",
};
//# sourceMappingURL=exception-recovery-types.js.map