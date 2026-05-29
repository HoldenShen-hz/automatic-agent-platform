import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useWsClient } from "@aa/shared-state";
import { approveApproval, deferApproval, editApproval, escalateApproval, fetchApprovals, rejectApproval, resumeWorkflow, submitApprovalTextInput, } from "@aa/shared-api-client";
const HITL_TEXT_INPUT_MAX_BYTES = 8 * 1024;
function toHitlItems(approvals) {
    const now = Date.now();
    return approvals.map((approval) => {
        const secondsRemaining = approval.deadline == null
            ? undefined
            : Math.max(0, Math.floor((new Date(approval.deadline).getTime() - now) / 1000));
        return {
            id: approval.approvalId,
            type: "approval",
            title: approval.taskId,
            description: `${approval.riskLevel} · ${approval.reasonSummary}`,
            ...(approval.deadline == null ? {} : { deadline: approval.deadline }),
            ...(approval.escalationTarget == null ? {} : { escalationTarget: approval.escalationTarget }),
            ...(secondsRemaining == null ? {} : { secondsRemaining }),
        };
    });
}
export function useHitlVm() {
    const client = useRestClient();
    const wsClient = useWsClient();
    const [approvals, setApprovals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingOperations, setPendingOperations] = useState(0);
    const [countdownTick, setCountdownTick] = useState(0);
    useEffect(() => {
        let mounted = true;
        void fetchApprovals(client)
            .then((items) => {
            if (mounted) {
                setApprovals(items);
                setIsLoading(false);
            }
        })
            .catch(() => {
            if (mounted) {
                setApprovals([]);
                setIsLoading(false);
            }
        });
        const unsubscribe = wsClient.subscribe("approvals", () => undefined);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [client, wsClient]);
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdownTick((current) => current + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    const items = useMemo(() => toHitlItems(approvals), [approvals, countdownTick]);
    const withPending = useCallback(async (operation) => {
        setPendingOperations((current) => current + 1);
        try {
            await operation();
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, []);
    const removeApproval = useCallback((approvalId) => {
        setApprovals((current) => current.filter((approval) => approval.approvalId !== approvalId));
    }, []);
    const approve = useCallback(async (approvalId) => {
        await withPending(async () => {
            await approveApproval(client, approvalId);
            removeApproval(approvalId);
        });
    }, [client, removeApproval, withPending]);
    const reject = useCallback(async (approvalId) => {
        await withPending(async () => {
            await rejectApproval(client, approvalId);
            removeApproval(approvalId);
        });
    }, [client, removeApproval, withPending]);
    const patch = useCallback(async (approvalId, patchPayload) => {
        await withPending(async () => {
            await submitApprovalTextInput(client, approvalId, encodeTextInputPayload({ action: "patch", patch: patchPayload }));
            removeApproval(approvalId);
        });
    }, [client, removeApproval, withPending]);
    const override = useCallback(async (approvalId, overridePayload) => {
        await withPending(async () => {
            await submitApprovalTextInput(client, approvalId, encodeTextInputPayload({ action: "override", override: overridePayload }));
            removeApproval(approvalId);
        });
    }, [client, removeApproval, withPending]);
    const edit = useCallback(async (approvalId, patchPayload) => {
        await withPending(async () => {
            await editApproval(client, approvalId, patchPayload);
        });
    }, [client, withPending]);
    const escalate = useCallback(async (approvalId, reason) => {
        await withPending(async () => {
            await escalateApproval(client, approvalId, reason);
        });
    }, [client, withPending]);
    const defer = useCallback(async (approvalId, until) => {
        await withPending(async () => {
            await deferApproval(client, approvalId, until);
        });
    }, [client, withPending]);
    const resume = useCallback(async (workflowId, mode) => {
        await withPending(async () => {
            await resumeWorkflow(client, workflowId, mode);
        });
    }, [client, withPending]);
    const bulkApprove = useCallback(async (approvalIds) => {
        await withPending(async () => {
            await Promise.all(approvalIds.map((approvalId) => approveApproval(client, approvalId)));
            setApprovals((current) => current.filter((approval) => !approvalIds.includes(approval.approvalId)));
        });
    }, [client, withPending]);
    const bulkReject = useCallback(async (approvalIds) => {
        await withPending(async () => {
            await Promise.all(approvalIds.map((approvalId) => rejectApproval(client, approvalId)));
            setApprovals((current) => current.filter((approval) => !approvalIds.includes(approval.approvalId)));
        });
    }, [client, withPending]);
    return {
        items,
        isLoading,
        pendingOperations,
        approve,
        reject,
        patch,
        override,
        edit,
        escalate,
        defer,
        resume,
        bulkApprove,
        bulkReject,
    };
}
function encodeTextInputPayload(payload) {
    const serialized = JSON.stringify(payload);
    if (new TextEncoder().encode(serialized).byteLength > HITL_TEXT_INPUT_MAX_BYTES) {
        throw new Error("hitl.patch_payload_too_large");
    }
    return serialized;
}
