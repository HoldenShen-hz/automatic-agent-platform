import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { DivisionInventorySnapshotDTO } from "@aa/shared-types";
import { fetchDivisionInventorySnapshot } from "@aa/shared-api-client";
import { useRestClient } from "@aa/shared-state";

export interface DivisionInventoryVm {
  readonly loading: boolean;
  readonly snapshot: DivisionInventorySnapshotDTO | null;
  readonly summaryRows: readonly { key: string; value: string }[];
  readonly familyOptions: readonly string[];
  readonly familyFilter: string;
  readonly statusFilter: string;
  readonly riskFilter: string;
  readonly blockerOnly: boolean;
  readonly filteredRecords: readonly DivisionInventorySnapshotDTO["records"][number][];
  setFamilyFilter(value: string): void;
  setStatusFilter(value: string): void;
  setRiskFilter(value: string): void;
  setBlockerOnly(value: boolean): void;
}

export function useDivisionInventoryVm(): DivisionInventoryVm {
  const client = useRestClient();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DivisionInventorySnapshotDTO | null>(null);
  const [familyFilter, setFamilyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [blockerOnly, setBlockerOnly] = useState(false);
  const deferredFamilyFilter = useDeferredValue(familyFilter);
  const deferredStatusFilter = useDeferredValue(statusFilter);
  const deferredRiskFilter = useDeferredValue(riskFilter);
  const deferredBlockerOnly = useDeferredValue(blockerOnly);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void fetchDivisionInventorySnapshot(client)
      .then((next) => {
        if (!mounted) {
          return;
        }
        startTransition(() => {
          setSnapshot(next);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setSnapshot(null);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [client]);

  const filteredRecords = useMemo(() => {
    const records = snapshot?.records ?? [];
    return records.filter((record) => {
      if (deferredFamilyFilter !== "all" && record.familyId !== deferredFamilyFilter) {
        return false;
      }
      if (deferredStatusFilter !== "all" && record.status !== deferredStatusFilter) {
        return false;
      }
      if (deferredRiskFilter !== "all" && record.riskLevel !== deferredRiskFilter) {
        return false;
      }
      if (deferredBlockerOnly && record.blockers.length === 0) {
        return false;
      }
      return true;
    });
  }, [snapshot, deferredFamilyFilter, deferredStatusFilter, deferredRiskFilter, deferredBlockerOnly]);

  const summaryRows = useMemo(() => snapshot == null
    ? []
    : [
      { key: "Divisions", value: String(snapshot.summary.totalDivisions) },
      { key: "P0 divisions", value: String(snapshot.summary.p0Divisions) },
      { key: "Blocked divisions", value: String(snapshot.summary.blockedDivisions) },
      { key: "Orphan modules", value: String(snapshot.summary.orphanSourceModules) },
    ], [snapshot]);

  const familyOptions = useMemo(() => [
    "all",
    ...new Set((snapshot?.records ?? []).map((record) => record.familyId).filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
  ], [snapshot]);

  return {
    loading,
    snapshot,
    summaryRows,
    familyOptions,
    familyFilter,
    statusFilter,
    riskFilter,
    blockerOnly,
    filteredRecords,
    setFamilyFilter,
    setStatusFilter,
    setRiskFilter,
    setBlockerOnly,
  };
}
