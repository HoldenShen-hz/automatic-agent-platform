export interface HitlItem {
    readonly id: string;
    readonly type: "approval" | "resume";
    readonly title: string;
    readonly description: string;
    readonly deadline?: string;
    readonly escalationTarget?: string;
    readonly secondsRemaining?: number;
}
export interface HitlVm {
    readonly items: readonly HitlItem[];
    readonly isLoading: boolean;
    readonly pendingOperations: number;
    approve(approvalId: string): Promise<void>;
    reject(approvalId: string): Promise<void>;
    patch(approvalId: string, patch: Record<string, unknown>): Promise<void>;
    override(approvalId: string, override: Record<string, unknown>): Promise<void>;
    edit(approvalId: string, patch: Record<string, unknown>): Promise<void>;
    escalate(approvalId: string, reason: string): Promise<void>;
    defer(approvalId: string, until: string): Promise<void>;
    resume(workflowId: string, mode: "normal" | "replan" | "supervised" | "abort"): Promise<void>;
    bulkApprove(approvalIds: readonly string[]): Promise<void>;
    bulkReject(approvalIds: readonly string[]): Promise<void>;
}
export declare function useHitlVm(): HitlVm;
