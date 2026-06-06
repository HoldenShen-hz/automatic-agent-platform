import { startTransition, useEffect, useMemo, useState } from "react";
import { fetchHealthReport } from "@aa/shared-api-client";
import { useRestClient, useSystemStatus } from "@aa/shared-state";
import type { HealthStatusReportDTO } from "@aa/shared-types";
import { createSystemHealthSummary } from "@aa/ui-core";

export interface HealthVm {
  readonly loading: boolean;
  readonly errorMessage: string | null;
  readonly rows: readonly { key: string; value: string }[];
  refresh(): Promise<void>;
}

function formatProviderSuccess(rate: number, recentCalls: number): string {
  if (recentCalls <= 0) {
    return `n/a (${recentCalls} calls)`;
  }
  return `${Math.round(rate * 100)}% (${recentCalls} calls)`;
}

export function useHealthVm(): HealthVm {
  const client = useRestClient();
  const status = useSystemStatus();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<HealthStatusReportDTO | null>(null);

  async function loadReport(): Promise<void> {
    const next = await fetchHealthReport(client);
    startTransition(() => {
      setReport(next);
      setLoading(false);
      setErrorMessage(null);
    });
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void loadReport().catch(() => {
      if (!mounted) {
        return;
      }
      setReport(null);
      setLoading(false);
      setErrorMessage("health.load_failed");
    });
    return () => {
      mounted = false;
    };
  }, [client]);

  const rows = useMemo(() => {
    const backendRows = report == null
      ? []
      : [
        { key: "Data Source", value: "backend /health" },
        { key: "Overall Status", value: report.status },
        { key: "DB Writable", value: report.dbWritable ? "yes" : "no" },
        { key: "Provider Health", value: report.providerHealth },
        { key: "Provider Success", value: formatProviderSuccess(report.providerSuccessRate, report.providerRecentCalls) },
        { key: "Active Executions", value: String(report.activeExecutions) },
        { key: "Queued Tasks", value: String(report.queuedTasks) },
        { key: "Degradation Mode", value: report.degradationMode },
        { key: "Tier1 Ack Backlog", value: String(report.tier1AckBacklog) },
        { key: "Queue Backlog", value: String(report.queueGovernance.backlogSize) },
        { key: "Dispatchable Backlog", value: String(report.queueGovernance.dispatchableBacklogSize) },
        { key: "Starvation", value: report.queueGovernance.starvationDetected ? "detected" : "clear" },
        { key: "Healthy Workers", value: `${report.workerHealth.healthyWorkers}/${report.workerHealth.totalWorkers}` },
        { key: "Busy Workers", value: String(report.workerHealth.busyWorkers) },
        { key: "Remote Workers", value: `${report.workerHealth.remoteConnectedWorkers}/${report.workerHealth.remoteWorkers}` },
        { key: "Load Skew", value: report.workerHealth.loadSkewDetected ? "detected" : "clear" },
        { key: "Event Loop Lag", value: report.eventLoopLagMs == null ? "n/a" : `${report.eventLoopLagMs} ms` },
        { key: "Memory RSS", value: `${report.memoryRssMb} MB` },
        { key: "Findings", value: report.findings.length === 0 ? "none" : report.findings.join(", ") },
      ];
    const shellRows = createSystemHealthSummary(status).map((item) => ({
      key: `Shell ${item.label}`,
      value: item.value,
    }));
    return [
      ...backendRows,
      ...(errorMessage == null ? [] : [{ key: "Backend Error", value: errorMessage }]),
      ...shellRows,
    ];
  }, [errorMessage, report, status]);

  return {
    loading,
    errorMessage,
    rows,
    refresh: async () => {
      setLoading(true);
      try {
        await loadReport();
      } catch {
        setReport(null);
        setLoading(false);
        setErrorMessage("health.load_failed");
      }
    },
  };
}
