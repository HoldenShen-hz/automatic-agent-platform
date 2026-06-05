import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import {
  approveException,
  fetchAuditLogs,
  fetchComplianceExceptions,
  fetchCompliancePolicies,
  rejectException,
  submitException,
  updateCompliancePolicy,
} from "@aa/shared-api-client";

export interface CompliancePolicyVm {
  readonly id: string;
  readonly name: string;
  readonly severity: string;
}

export interface ComplianceAuditVm {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: string;
}

export interface ComplianceExceptionVm {
  readonly id: string;
  readonly reason: string;
  readonly policyId: string;
  readonly status: "pending" | "approved" | "rejected";
}

export interface GovernanceComplianceVm {
  readonly items: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly selectedPolicyId: string | null;
  readonly policies: readonly CompliancePolicyVm[];
  readonly auditTrail: readonly ComplianceAuditVm[];
  readonly exceptionQueue: readonly ComplianceExceptionVm[];
  refresh(): Promise<void>;
  selectPolicy(policyId: string): void;
  updatePolicy(policyId: string, patch: Record<string, unknown>): Promise<void>;
  submitExceptionRequest(reason: string, policyId: string): Promise<void>;
  approveException(exceptionId: string): Promise<void>;
  rejectException(exceptionId: string, rationale: string): Promise<void>;
  filterAuditTrail(): void;
}

export function useGovernanceComplianceVm(): GovernanceComplianceVm {
  const client = useRestClient();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<readonly CompliancePolicyVm[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<readonly ComplianceAuditVm[]>([]);
  const [exceptionQueue, setExceptionQueue] = useState<readonly ComplianceExceptionVm[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextPolicies, nextAuditTrail, nextExceptions] = await Promise.all([
        fetchCompliancePolicies(client),
        fetchAuditLogs(client),
        fetchComplianceExceptions(client),
      ]);
      setPolicies(nextPolicies);
      setSelectedPolicyId((current) => current != null && nextPolicies.some((policy) => policy.id === current) ? current : nextPolicies[0]?.id ?? null);
      setAuditTrail(nextAuditTrail.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        actor: entry.actor,
        action: entry.action,
        resource: entry.resource,
        outcome: entry.outcome,
      })));
      setExceptionQueue(nextExceptions.map((entry) => ({
        id: entry.id,
        reason: entry.reason,
        policyId: entry.policyId,
        status: entry.status,
      })));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    let mounted = true;
    void refresh().catch(() => {
      if (mounted) {
        setPolicies([]);
        setAuditTrail([]);
        setExceptionQueue([]);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const items = useMemo(() => [
    {
      title: translateMessage("ui.governanceCompliance.item.score.title"),
      description: translateMessage("ui.governanceCompliance.item.score.description", { count: policies.length }),
    },
    {
      title: translateMessage("ui.governanceCompliance.item.queue.title"),
      description: translateMessage("ui.governanceCompliance.item.queue.description", {
        count: exceptionQueue.filter((item) => item.status === "pending").length,
      }),
    },
    {
      title: translateMessage("ui.governanceCompliance.item.audit.title"),
      description: translateMessage("ui.governanceCompliance.item.audit.description", { count: auditTrail.length }),
    },
  ], [auditTrail.length, exceptionQueue, policies.length]);

  const updatePolicy = useCallback(async (policyId: string, patch: Record<string, unknown>) => {
    await updateCompliancePolicy(client, policyId, patch);
    await refresh();
  }, [client, refresh]);

  const submitExceptionRequest = useCallback(async (reason: string, policyId: string) => {
    if (policyId.trim().length === 0) {
      throw new Error("governance_compliance.policy_required");
    }
    await submitException(client, reason, policyId);
    await refresh();
  }, [client, refresh]);

  const approveExceptionAction = useCallback(async (exceptionId: string) => {
    await approveException(client, exceptionId);
    await refresh();
  }, [client, refresh]);

  const rejectExceptionAction = useCallback(async (exceptionId: string, rationale: string) => {
    await rejectException(client, exceptionId, rationale);
    await refresh();
  }, [client, refresh]);

  const filterAuditTrail = useCallback(() => {
    setAuditTrail((current) => [...current].sort((left, right) => right.timestamp.localeCompare(left.timestamp)));
  }, []);

  return {
    items,
    loading,
    selectedPolicyId,
    policies,
    auditTrail,
    exceptionQueue,
    refresh,
    selectPolicy: setSelectedPolicyId,
    updatePolicy,
    submitExceptionRequest,
    approveException: approveExceptionAction,
    rejectException: rejectExceptionAction,
    filterAuditTrail,
  };
}
