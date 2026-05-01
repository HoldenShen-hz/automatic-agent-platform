import { useCallback, useEffect, useState } from "react";
import { useRestClient } from "@aa/shared-state";
import type { CompliancePolicy, AuditLogEntry, ApprovalQueueItem } from "@aa/shared-types";
import { fetchCompliancePolicies, updateCompliancePolicy, fetchAuditLogs, submitException, approveException, rejectException } from "@aa/shared-api-client";

export interface ComplianceScore {
  readonly overall: number;
  readonly categories: readonly { name: string; score: number; findings: number }[];
  readonly lastAudit: string;
}

export interface AuditTrailEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: "success" | "failure" | "warning";
  readonly metadata?: Record<string, unknown>;
}

export interface ExceptionRequest {
  readonly id: string;
  readonly reason: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly submittedAt: string;
  readonly reviewedAt?: string;
  readonly reviewer?: string;
}

export interface GovernanceComplianceVm {
  readonly items: readonly { title: string; description: string }[];
  readonly hasAuditTrailViewer: boolean;
  readonly hasExceptionManagement: boolean;
  // §2266: Policy editor capabilities
  readonly policies: readonly CompliancePolicy[];
  readonly selectedPolicyId: string | null;
  readonly auditTrail: readonly AuditTrailEntry[];
  readonly exceptionQueue: readonly ExceptionRequest[];
  readonly loading: boolean;
  selectPolicy(id: string): void;
  updatePolicy(id: string, updates: Partial<CompliancePolicy>): Promise<void>;
  submitExceptionRequest(reason: string, policyId: string): Promise<void>;
  approveException(exceptionId: string): Promise<void>;
  rejectException(exceptionId: string, reason: string): Promise<void>;
  // §2266: Audit trail filtering
  filterAuditTrail(startDate: string, endDate: string, actor?: string): void;
}

export function useGovernanceComplianceVm(): GovernanceComplianceVm {
  const client = useRestClient();
  const [policies, setPolicies] = useState<readonly CompliancePolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<readonly AuditTrailEntry[]>([]);
  const [exceptionQueue, setExceptionQueue] = useState<readonly ExceptionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<{ startDate: string; endDate: string; actor?: string }>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  // §2266: Fetch policies, audit logs, and exception queue on mount
  useEffect(() => {
    if (client == null) return;
    setLoading(true);

    void Promise.all([
      fetchCompliancePolicies(client).then(setPolicies).catch(() => []),
      fetchAuditLogs(client, auditFilter.startDate, auditFilter.endDate, auditFilter.actor).then((logs) => {
        const entries: AuditTrailEntry[] = logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          actor: log.actor,
          action: log.action,
          resource: log.resource,
          outcome: log.outcome as "success" | "failure" | "warning",
          metadata: log.metadata,
        }));
        setAuditTrail(entries);
      }).catch(() => []),
    ]).finally(() => setLoading(false));
  }, [client, auditFilter.startDate, auditFilter.endDate, auditFilter.actor]);

  const selectPolicy = useCallback((id: string) => {
    setSelectedPolicyId(id);
  }, []);

  const updatePolicy = useCallback(async (id: string, updates: Partial<CompliancePolicy>) => {
    if (client == null) return;
    await updateCompliancePolicy(client, id, updates);
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, [client]);

  const submitExceptionRequest = useCallback(async (reason: string, policyId: string) => {
    if (client == null) return;
    const result = await submitException(client, { reason, policyId });
    setExceptionQueue((prev) => [
      {
        id: result.id,
        reason,
        status: "pending",
        submittedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, [client]);

  const approveException = useCallback(async (exceptionId: string) => {
    if (client == null) return;
    await approveException(client, exceptionId);
    setExceptionQueue((prev) =>
      prev.map((e) =>
        e.id === exceptionId
          ? { ...e, status: "approved" as const, reviewedAt: new Date().toISOString() }
          : e,
      ),
    );
  }, [client]);

  const rejectException = useCallback(async (exceptionId: string, reason: string) => {
    if (client == null) return;
    await rejectException(client, exceptionId, reason);
    setExceptionQueue((prev) =>
      prev.map((e) =>
        e.id === exceptionId
          ? { ...e, status: "rejected" as const, reviewedAt: new Date().toISOString() }
          : e,
      ),
    );
  }, [client]);

  const filterAuditTrail = useCallback((startDate: string, endDate: string, actor?: string) => {
    setAuditFilter({ startDate, endDate, actor });
  }, []);

  return {
    items: [
      { title: "Compliance Score", description: "标准、检查项和最近审计结果通过 planned seam 呈现。" },
      { title: "Field Redaction Policy", description: "字段级可见性、PII handling 和审计访问规则。" },
      { title: "Audit Trail", description: "审计轨迹查看器 - 合规性相关操作的完整历史记录。" },
      { title: "Delegated Governance", description: "域治理委托与审批升级路径。" },
      { title: "Exception Management", description: "异常管理面板 - 豁免申请、审批和追踪。" },
    ],
    hasAuditTrailViewer: true,
    hasExceptionManagement: true,
    policies,
    selectedPolicyId,
    auditTrail,
    exceptionQueue,
    loading,
    selectPolicy,
    updatePolicy,
    submitExceptionRequest,
    approveException,
    rejectException,
    filterAuditTrail,
  };
}