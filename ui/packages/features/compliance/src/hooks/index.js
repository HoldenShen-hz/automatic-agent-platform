import { useEffect, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { fetchAuditLogs, fetchComplianceExceptions, fetchCompliancePolicies } from "@aa/shared-api-client";
export function useComplianceVm() {
    const client = useRestClient();
    const [policies, setPolicies] = useState([]);
    const [exceptions, setExceptions] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
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
                setLoadError(null);
            }
            catch (error) {
                if (!mounted) {
                    return;
                }
                setPolicies([]);
                setExceptions([]);
                setAuditLogs([]);
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
    const criticalCount = policies.filter((policy) => policy.severity === "critical").length;
    const pendingExceptions = exceptions.filter((exception) => exception.status === "pending");
    const approvedExceptions = exceptions.filter((exception) => exception.status === "approved").length;
    const exceptionPassRate = exceptions.length === 0
        ? "100%"
        : `${Math.round((approvedExceptions / exceptions.length) * 100)}%`;
    return {
        metrics: [
            { label: "标准项", value: policies.length },
            { label: "待处理检查", value: auditLogs.length },
            { label: "通过率", value: exceptionPassRate },
        ],
        rows: [
            { key: "模式", value: policies.map((policy) => policy.name).join(" / ") || "No policies" },
            { key: "字段策略", value: `${criticalCount} critical policies, ${pendingExceptions.length} pending exceptions` },
            { key: "审计轨迹", value: auditLogs[0] == null ? "No recent audit trail" : `${auditLogs[0].action} @ ${auditLogs[0].timestamp}` },
        ],
        items: [
            { title: "Compliance feed", description: policies[0] == null ? "No compliance standards were returned by the backend." : `${policies[0].name} is present in the live governance registry.` },
            { title: "Exception queue", description: pendingExceptions[0] == null ? "No pending compliance exceptions are waiting for operator review." : `${pendingExceptions[0].reason} is still pending review.` },
            { title: "Contract boundary", description: "Dedicated compliance check execution and report export APIs are still not promoted beyond the governance surfaces." },
        ],
        loading,
        loadError,
    };
}
