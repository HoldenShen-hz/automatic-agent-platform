import type { ApprovalDTO } from "@aa/shared-types";
export interface ApprovalCenterVm {
    readonly approvals: readonly ApprovalDTO[];
    readonly queueItems: readonly {
        id: string;
        title: string;
        subtitle: string;
    }[];
    readonly selectedId: string | null;
    readonly selectedApproval: ApprovalDTO | null;
    readonly actionHistory: readonly {
        title: string;
        description: string;
    }[];
    readonly queueDepth: number;
    readonly pendingOperations: number;
    selectApproval(id: string): void;
    approve(): Promise<void>;
    reject(): Promise<void>;
    delegate(target: string): Promise<void>;
    requestMoreContext(): Promise<void>;
    approveBatch(approvalIds: readonly string[]): Promise<void>;
    rejectBatch(approvalIds: readonly string[]): Promise<void>;
}
export declare function mapApprovalsToVm(approvals: readonly ApprovalDTO[]): Pick<ApprovalCenterVm, "approvals" | "queueItems" | "queueDepth">;
export declare function useApprovalCenterVm(): ApprovalCenterVm;
