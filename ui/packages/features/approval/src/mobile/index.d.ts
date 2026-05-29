import { type RESTClient } from "@aa/shared-api-client";
import type { ApprovalDTO } from "@aa/shared-types";
export declare function createApprovalMobileCards(approvals: readonly ApprovalDTO[], client?: RESTClient): ({
    onApprove(): Promise<void>;
    title: string;
    subtitle: string;
    badge?: string;
    id: string;
    actionType: "approve";
} | {
    onReject(): Promise<void>;
    title: string;
    subtitle: string;
    badge?: string;
    id: string;
    actionType: "reject";
})[];
