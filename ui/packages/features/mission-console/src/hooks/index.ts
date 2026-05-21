import { useEffect, useState } from "react";
import { fetchMissionBudget, fetchMissionEvidence, fetchMissionRuns, fetchMissionTasks } from "@aa/shared-api-client";
import { useMissionsQuery, useRestClient } from "@aa/shared-state";
import type { MissionBudgetSummaryDTO, MissionDTO, MissionResourceDTO } from "@aa/shared-types";

export interface MissionConsoleVm {
  readonly loading: boolean;
  readonly missions: readonly MissionDTO[];
  readonly selectedMission: MissionDTO | null;
  readonly selectedMissionId: string | null;
  readonly tasks: readonly MissionResourceDTO[];
  readonly runs: readonly MissionResourceDTO[];
  readonly evidence: readonly MissionResourceDTO[];
  readonly budget: MissionBudgetSummaryDTO | null;
  selectMission(missionId: string): void;
}

export function mapMissionsToConsoleVm(missions: readonly MissionDTO[], selectedMissionId: string | null) {
  const selectedMission = missions.find((mission) => mission.missionId === selectedMissionId) ?? missions[0] ?? null;
  return {
    missions,
    selectedMission,
    selectedMissionId: selectedMission?.missionId ?? null,
  };
}

export function useMissionConsoleVm(): MissionConsoleVm {
  const client = useRestClient();
  const query = useMissionsQuery();
  const missions = query.data ?? [];
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<readonly MissionResourceDTO[]>([]);
  const [runs, setRuns] = useState<readonly MissionResourceDTO[]>([]);
  const [evidence, setEvidence] = useState<readonly MissionResourceDTO[]>([]);
  const [budget, setBudget] = useState<MissionBudgetSummaryDTO | null>(null);
  const mapped = mapMissionsToConsoleVm(missions, selectedMissionId);

  useEffect(() => {
    if (mapped.selectedMissionId == null) {
      setTasks([]);
      setRuns([]);
      setEvidence([]);
      setBudget(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchMissionTasks(client, mapped.selectedMissionId),
      fetchMissionRuns(client, mapped.selectedMissionId),
      fetchMissionEvidence(client, mapped.selectedMissionId),
      fetchMissionBudget(client, mapped.selectedMissionId),
    ]).then(([nextTasks, nextRuns, nextEvidence, nextBudget]) => {
      if (!cancelled) {
        setTasks(nextTasks);
        setRuns(nextRuns);
        setEvidence(nextEvidence);
        setBudget(nextBudget);
      }
    }).catch(() => {
      if (!cancelled) {
        setTasks([]);
        setRuns([]);
        setEvidence([]);
        setBudget(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, mapped.selectedMissionId]);

  return {
    loading: query.isLoading,
    ...mapped,
    tasks,
    runs,
    evidence,
    budget,
    selectMission: setSelectedMissionId,
  };
}
