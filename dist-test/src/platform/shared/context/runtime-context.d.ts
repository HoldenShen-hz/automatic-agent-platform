/**
 * @fileoverview Runtime Context Propagation via AsyncLocalStorage.
 *
 * Shared context propagation lives under platform/shared so interface, control,
 * execution, and state/evidence planes can depend on the same context contract
 * without introducing reverse dependencies on execution-specific modules.
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
    tenantId?: string | null;
    workspaceId?: string | null;
}
export declare function provideContext<T>(snapshot: RuntimeContextSnapshot, fn: () => T | Promise<T>): T | Promise<T>;
export declare function getContext(): RuntimeContextSnapshot;
export declare function getContextOrNull(): RuntimeContextSnapshot | null;
export declare function withContextPatch<T>(patch: Partial<RuntimeContextSnapshot>, fn: () => T): T;
export declare function assertContext(...requiredKeys: (keyof RuntimeContextSnapshot)[]): RuntimeContextSnapshot;
export declare function getTenantId(): string | null;
export declare function getTenantIdOrNull(): string | null;
export declare function getWorkspaceId(): string | null;
export declare function getWorkspaceIdOrNull(): string | null;
export declare function hasTenantContext(): boolean;
export declare function hasWorkspaceContext(): boolean;
