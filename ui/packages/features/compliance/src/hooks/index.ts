import { useEffect, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { fetchAuditLogs, fetchComplianceExceptions, fetchCompliancePolicies } from "@aa/shared-api-client";
import { translateMessage } from "@aa/shared-i18n";

type PolicySummary = {
  readonly id: string;
  readonly name: string;
  readonly severity: string;
};

type ComplianceExceptionRecord = {
  readonly id: string;
  readonly reason: string;
  readonly policyId: string;
  readonly status: "pending" | "approved" | "rejected";
};

type AuditLogEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly action: string;
};

export interface ComplianceVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly rows: readonly { key: string; value: string }[];
  readonly items: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly loadError: string | null;
}

export function useComplianceVm(): ComplianceVm {
  const client = useRestClient();
  const [policies, setPolicies] = useState<readonly PolicySummary[]>([]);
  const [exceptions, setExceptions] = useState<readonly ComplianceExceptionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<readonly AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      } catch (error: unknown) {
        if (!mounted) {
          return;
        }
        setPolicies([]);
        setExceptions([]);
        setAuditLogs([]);
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
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
      { label: translateMessage("ui.compliance.metric.standards"), value: policies.length },
      { label: translateMessage("ui.compliance.metric.checks"), value: auditLogs.length },
      { label: translateMessage("ui.compliance.metric.passing"), value: exceptionPassRate },
    ],
    rows: [
      { key: translateMessage("ui.compliance.row.mode"), value: policies.map((policy) => policy.name).join(" / ") || "No policies" },
      { key: translateMessage("ui.compliance.row.fieldPolicy"), value: `${criticalCount} critical policies, ${pendingExceptions.length} pending exceptions` },
      { key: translateMessage("ui.compliance.row.auditTrail"), value: auditLogs[0] == null ? "No recent audit trail" : `${auditLogs[0].action} @ ${auditLogs[0].timestamp}` },
    ],
    items: [
      {
        title: "Compliance feed",
        description: policies[0] == null ? "No compliance standards were returned by the backend." : `${policies[0].name} is present in the live governance registry.`,
      },
      {
        title: "Exception queue",
        description: pendingExceptions[0] == null ? "No pending compliance exceptions are waiting for operator review." : `${pendingExceptions[0].reason} is still pending review.`,
      },
      {
        title: "Contract boundary",
        description: "Dedicated compliance check execution and report export APIs are still not promoted beyond the governance surfaces.",
      },
    ],
    loading,
    loadError,
  };
}
