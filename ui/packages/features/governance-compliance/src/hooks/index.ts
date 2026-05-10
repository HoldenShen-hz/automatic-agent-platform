import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import {
  approveException,
  fetchAuditLogs,
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
  readonly status: "pending" | "approved" | "rejected";
}

export interface GovernanceComplianceVm {
  readonly items: readonly { title: string; description: string }[];
  readonly selectedPolicyId: string | null;
  readonly policies: readonly CompliancePolicyVm[];
  readonly auditTrail: readonly ComplianceAuditVm[];
  readonly exceptionQueue: readonly ComplianceExceptionVm[];
  selectPolicy(policyId: string): void;
  updatePolicy(policyId: string, patch: Record<string, unknown>): Promise<void>;
  submitExceptionRequest(reason: string, policyId: string): Promise<void>;
  approveException(exceptionId: string): Promise<void>;
  rejectException(exceptionId: string, rationale: string): Promise<void>;
  filterAuditTrail(): void;
}

export function useGovernanceComplianceVm(): GovernanceComplianceVm {
  const client = useRestClient();
  const [policies, setPolicies] = useState<readonly CompliancePolicyVm[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<readonly ComplianceAuditVm[]>([]);
  const [exceptionQueue, setExceptionQueue] = useState<readonly ComplianceExceptionVm[]>([]);

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

  const updatePolicy = useCallback(async (policyId: string, patch: Record<string, unknown>) => {
    await updateCompliancePolicy(client, policyId, patch);
  }, [client]);

  const submitExceptionRequest = useCallback(async (reason: string, policyId: string) => {
    const result = await submitException(client, reason, policyId);
    setExceptionQueue((current) => [{ id: result.id, reason, status: "pending" }, ...current]);
  }, [client]);

  const approveExceptionAction = useCallback(async (exceptionId: string) => {
    await approveException(client, exceptionId);
    setExceptionQueue((current) => current.map((item) => item.id === exceptionId ? { ...item, status: "approved" } : item));
  }, [client]);

  const rejectExceptionAction = useCallback(async (exceptionId: string, rationale: string) => {
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
