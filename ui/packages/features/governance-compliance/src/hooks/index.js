import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { approveException, fetchAuditLogs, fetchCompliancePolicies, rejectException, submitException, updateCompliancePolicy, } from "@aa/shared-api-client";
export function useGovernanceComplianceVm() {
    const client = useRestClient();
    const [policies, setPolicies] = useState([]);
    const [selectedPolicyId, setSelectedPolicyId] = useState(null);
    const [auditTrail, setAuditTrail] = useState([]);
    const [exceptionQueue, setExceptionQueue] = useState([]);
    useEffect(() => {
        let mounted = true;
        void Promise.all([
            fetchCompliancePolicies(client),
            fetchAuditLogs(client),
        ]).then(([nextPolicies, nextAuditTrail]) => {
            if (!mounted) {
                return;
            }
            setPolicies(nextPolicies);
            setSelectedPolicyId(nextPolicies[0]?.id ?? null);
            setAuditTrail(nextAuditTrail.map((entry) => ({
                id: entry.id,
                timestamp: entry.timestamp,
                actor: entry.actor,
                action: entry.action,
                resource: entry.resource,
                outcome: entry.outcome,
            })));
        }).catch(() => {
            if (mounted) {
                setPolicies([]);
                setAuditTrail([]);
            }
        });
        return () => {
            mounted = false;
        };
    }, [client]);
    const items = useMemo(() => [
        { title: "Compliance Score", description: `${policies.length} active policies under review.` },
        { title: "Approval Queue", description: `${exceptionQueue.filter((item) => item.status === "pending").length} pending governance exceptions.` },
        { title: "Audit Trail", description: `${auditTrail.length} recent governance actions captured.` },
    ], [auditTrail.length, exceptionQueue, policies.length]);
    const updatePolicy = useCallback(async (policyId, patch) => {
        await updateCompliancePolicy(client, policyId, patch);
    }, [client]);
    const submitExceptionRequest = useCallback(async (reason, policyId) => {
        const result = await submitException(client, reason, policyId);
        setExceptionQueue((current) => [{ id: result.id, reason, status: "pending" }, ...current]);
    }, [client]);
    const approveExceptionAction = useCallback(async (exceptionId) => {
        await approveException(client, exceptionId);
        setExceptionQueue((current) => current.map((item) => item.id === exceptionId ? { ...item, status: "approved" } : item));
    }, [client]);
    const rejectExceptionAction = useCallback(async (exceptionId, rationale) => {
        await rejectException(client, exceptionId, rationale);
        setExceptionQueue((current) => current.map((item) => item.id === exceptionId ? { ...item, status: "rejected" } : item));
    }, [client]);
    const filterAuditTrail = useCallback(() => {
        setAuditTrail((current) => [...current].sort((left, right) => right.timestamp.localeCompare(left.timestamp)));
    }, []);
    return {
        items,
        selectedPolicyId,
        policies,
        auditTrail,
        exceptionQueue,
        selectPolicy: setSelectedPolicyId,
        updatePolicy,
        submitExceptionRequest,
        approveException: approveExceptionAction,
        rejectException: rejectExceptionAction,
        filterAuditTrail,
    };
}
