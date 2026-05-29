import { useCallback, useEffect, useMemo, useState } from "react";
import { useApprovalsQuery, useRestClient } from "@aa/shared-state";
import { approveApproval, delegateApproval, rejectApproval, requestMoreContextApproval, } from "@aa/shared-api-client";
export function mapApprovalsToVm(approvals) {
    return {
        approvals,
        queueItems: approvals.map((approval) => ({
            id: approval.approvalId,
            title: approval.taskId,
            subtitle: approval.riskLevel,
        })),
        queueDepth: approvals.length,
    };
}
function removeApproval(approvals, approvalId) {
    return approvals.filter((approval) => approval.approvalId !== approvalId);
}
export function useApprovalCenterVm() {
    const client = useRestClient();
    const queryApprovals = useApprovalsQuery().data ?? [];
    const approvalFeedVersion = JSON.stringify(queryApprovals.map((approval) => ({
        approvalId: approval.approvalId,
        taskId: approval.taskId,
        riskLevel: approval.riskLevel,
        reasonSummary: approval.reasonSummary,
        deadline: approval.deadline ?? null,
        policySource: approval.policySource ?? null,
        recommendedOption: approval.recommendedOption ?? null,
        currentLevel: approval.currentLevel ?? null,
        totalLevels: approval.totalLevels ?? null,
    })));
    const syncedQueryApprovals = useMemo(() => queryApprovals, [approvalFeedVersion]);
    const [approvals, setApprovals] = useState(syncedQueryApprovals);
    const [selectedId, setSelectedId] = useState(syncedQueryApprovals[0]?.approvalId ?? null);
    const [actionHistory, setActionHistory] = useState([]);
    const [pendingOperations, setPendingOperations] = useState(0);
    useEffect(() => {
        setApprovals(syncedQueryApprovals);
        setSelectedId((current) => {
            if (current != null && syncedQueryApprovals.some((approval) => approval.approvalId === current)) {
                return current;
            }
            return syncedQueryApprovals[0]?.approvalId ?? null;
        });
    }, [approvalFeedVersion, syncedQueryApprovals]);
    const baseVm = useMemo(() => mapApprovalsToVm(approvals), [approvals]);
    const selectedApproval = approvals.find((approval) => approval.approvalId === selectedId) ?? approvals[0] ?? null;
    const withPending = useCallback(async (operation) => {
        setPendingOperations((current) => current + 1);
        try {
            await operation();
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, []);
    const applyOptimisticRemoval = useCallback((approvalId, title, description) => {
        setApprovals((current) => {
            const nextApprovals = removeApproval(current, approvalId);
            setSelectedId(nextApprovals[0]?.approvalId ?? null);
            return nextApprovals;
        });
        setActionHistory((history) => [{ title, description }, ...history]);
    }, []);
    const restoreApprovals = useCallback((snapshot, restoredSelectedId) => {
        setApprovals(snapshot);
        setSelectedId(restoredSelectedId);
    }, []);
    const approve = useCallback(async () => {
        if (selectedApproval == null) {
            return;
        }
        const snapshot = approvals;
        const snapshotSelectedId = selectedApproval.approvalId;
        applyOptimisticRemoval(selectedApproval.approvalId, `Approved · ${selectedApproval.taskId}`, `${selectedApproval.riskLevel} risk request approved.`);
        await withPending(async () => {
            try {
                await approveApproval(client, selectedApproval.approvalId);
            }
            catch (error) {
                restoreApprovals(snapshot, snapshotSelectedId);
                throw error;
            }
        });
    }, [approvals, applyOptimisticRemoval, client, restoreApprovals, selectedApproval, withPending]);
    const reject = useCallback(async () => {
        if (selectedApproval == null) {
            return;
        }
        const snapshot = approvals;
        const snapshotSelectedId = selectedApproval.approvalId;
        applyOptimisticRemoval(selectedApproval.approvalId, `Rejected · ${selectedApproval.taskId}`, `${selectedApproval.riskLevel} risk request rejected.`);
        await withPending(async () => {
            try {
                await rejectApproval(client, selectedApproval.approvalId);
            }
            catch (error) {
                restoreApprovals(snapshot, snapshotSelectedId);
                throw error;
            }
        });
    }, [approvals, applyOptimisticRemoval, client, restoreApprovals, selectedApproval, withPending]);
    const delegate = useCallback(async (target) => {
        if (selectedApproval == null) {
            return;
        }
        const snapshot = approvals;
        const snapshotSelectedId = selectedApproval.approvalId;
        applyOptimisticRemoval(selectedApproval.approvalId, `Delegated · ${selectedApproval.taskId}`, `Approval was delegated to ${target} for supervised decision.`);
        await withPending(async () => {
            try {
                await delegateApproval(client, selectedApproval.approvalId, target);
            }
            catch (error) {
                restoreApprovals(snapshot, snapshotSelectedId);
                throw error;
            }
        });
    }, [approvals, applyOptimisticRemoval, client, restoreApprovals, selectedApproval, withPending]);
    const requestMoreContext = useCallback(async () => {
        if (selectedApproval == null) {
            return;
        }
        await withPending(async () => {
            await requestMoreContextApproval(client, selectedApproval.approvalId);
            setActionHistory((history) => [
                {
                    title: `Requested Context · ${selectedApproval.taskId}`,
                    description: "Reviewer requested more supporting evidence before decision.",
                },
                ...history,
            ]);
        });
    }, [client, selectedApproval, withPending]);
    const approveBatch = useCallback(async (approvalIds) => {
        await withPending(async () => {
            const results = await Promise.allSettled(approvalIds.map((approvalId) => approveApproval(client, approvalId)));
            const succeeded = approvalIds.filter((_approvalId, index) => results[index]?.status === "fulfilled");
            const failed = results.filter((result) => result.status === "rejected");
            if (succeeded.length > 0) {
                setApprovals((current) => current.filter((approval) => !succeeded.includes(approval.approvalId)));
            }
            if (failed.length > 0) {
                throw new AggregateError(failed.map((result) => result.reason), "approval.batch_approve_partial_failure");
            }
        });
    }, [client, withPending]);
    const rejectBatch = useCallback(async (approvalIds) => {
        await withPending(async () => {
            const results = await Promise.allSettled(approvalIds.map((approvalId) => rejectApproval(client, approvalId)));
            const succeeded = approvalIds.filter((_approvalId, index) => results[index]?.status === "fulfilled");
            const failed = results.filter((result) => result.status === "rejected");
            if (succeeded.length > 0) {
                setApprovals((current) => current.filter((approval) => !succeeded.includes(approval.approvalId)));
            }
            if (failed.length > 0) {
                throw new AggregateError(failed.map((result) => result.reason), "approval.batch_reject_partial_failure");
            }
        });
    }, [client, withPending]);
    return {
        ...baseVm,
        selectedId,
        selectedApproval,
        actionHistory,
        pendingOperations,
        selectApproval: setSelectedId,
        approve,
        reject,
        delegate,
        requestMoreContext,
        approveBatch,
        rejectBatch,
    };
}
