import { useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { fetchAuditLogs, fetchComplianceExceptions, fetchCompliancePolicies } from "@aa/shared-api-client";
function mapPolicyToListItem(policy, exceptions) {
    const pendingCount = exceptions.filter((exception) => exception.policyId === policy.id && exception.status === "pending").length;
    return {
        id: policy.id,
        title: `${policy.name} · ${policy.severity}`,
        subtitle: pendingCount > 0 ? `${pendingCount} pending exceptions` : "No pending exceptions",
    };
}
function buildDetailRows(policy, exceptions, auditLogs) {
    if (policy == null) {
        return [];
    }
    const policyExceptions = exceptions.filter((exception) => exception.policyId === policy.id);
    const latestAudit = auditLogs.find((entry) => entry.resource === `compliance-policy:${policy.id}`) ?? null;
    return [
        { key: "Policy", value: policy.name },
        { key: "Severity", value: policy.severity },
        { key: "Policy ID", value: policy.id },
        { key: "Exceptions", value: String(policyExceptions.length) },
        { key: "Pending Exceptions", value: String(policyExceptions.filter((exception) => exception.status === "pending").length) },
        { key: "Latest Audit", value: latestAudit == null ? "No direct policy audit record yet" : `${latestAudit.action} @ ${latestAudit.timestamp}` },
    ];
}
export function usePolicyVm() {
    const client = useRestClient();
    const [loading, setLoading] = useState(true);
    const [policies, setPolicies] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loadError, setLoadError] = useState(null);
    useEffect(() => {
        let mounted = true;
        void (async () => {
            setLoading(true);
            try {
                const [nextPolicies, nextExceptions, nextAuditLogs] = await Promise.all([
                    fetchCompliancePolicies(client),
                    fetchComplianceExceptions(client),
                    fetchAuditLogs(client),
                ]);
                if (!mounted) {
                    return;
                }
                setPolicies(nextPolicies);
                setExceptions(nextExceptions);
                setAuditLogs(nextAuditLogs);
                setSelectedId((current) => (current != null && nextPolicies.some((policy) => policy.id === current)
                    ? current
                    : nextPolicies[0]?.id ?? null));
                setLoadError(null);
            }
            catch (error) {
                if (!mounted) {
                    return;
                }
                setPolicies([]);
                setExceptions([]);
                setAuditLogs([]);
                setSelectedId(null);
                setLoadError(error instanceof Error ? error.message : String(error));
            }
            finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            mounted = false;
        };
    }, [client]);
    const selectedPolicy = policies.find((policy) => policy.id === selectedId) ?? null;
    const selectedExceptions = selectedPolicy == null
        ? []
        : exceptions.filter((exception) => exception.policyId === selectedPolicy.id);
    const selectedAuditEntries = selectedPolicy == null
        ? []
        : auditLogs.filter((entry) => (entry.resource === `compliance-policy:${selectedPolicy.id}`
            || entry.metadata?.["policyId"] === selectedPolicy.id));
    return {
        metrics: [
            { label: "Policies", value: policies.length },
            { label: "Critical", value: policies.filter((policy) => policy.severity === "critical").length },
            { label: "Pending Exceptions", value: exceptions.filter((exception) => exception.status === "pending").length },
        ],
        listItems: policies.map((policy) => mapPolicyToListItem(policy, exceptions)),
        selectedId,
        detailRows: buildDetailRows(selectedPolicy, exceptions, auditLogs),
        summaryItems: useMemo(() => [
            {
                title: "Governance feed",
                description: selectedPolicy == null
                    ? "No compliance policy has been published by the backend yet."
                    : `${selectedPolicy.name} is loaded from the real governance policy registry.`,
            },
            {
                title: "Recent audit",
                description: selectedAuditEntries[0] == null
                    ? "No policy-specific audit record is available yet."
                    : `${selectedAuditEntries[0].action} by ${selectedAuditEntries[0].actor}.`,
            },
            {
                title: "Contract boundary",
                description: "Policy simulate, publish, and rollback workflows still need dedicated policy-control API routes.",
            },
        ], [selectedAuditEntries, selectedPolicy]),
        exceptionItems: selectedExceptions.length === 0
            ? [{ title: "No exceptions", description: "The selected policy has no exception requests in the runtime queue." }]
            : selectedExceptions.map((exception) => ({
                title: `${exception.reason} · ${exception.status}`,
                description: exception.id,
            })),
        loading,
        loadError,
        selectPolicy(policyId) {
            setSelectedId(policyId);
        },
    };
}
