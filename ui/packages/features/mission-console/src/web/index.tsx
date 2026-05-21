import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { useMissionConsoleVm } from "../hooks";

export function MissionConsoleWebView(): ReactElement {
  const vm = useMissionConsoleVm();
  const mission = vm.selectedMission;
  return (
    <FeatureScaffold
      title="Mission Console"
      summary="目标、预算、任务、运行和证据在一个治理视图里汇合。"
      status="Implemented/Contracted"
    >
      {vm.loading ? <p>Loading missions...</p> : (
        <ThreePaneLayout
          left={(
            <ListCard items={vm.missions.map((item) => ({
              title: item.title,
              description: `${item.status} / ${item.priority} / ${item.type}`,
              actionLabel: item.missionId === vm.selectedMissionId ? "Selected" : "Open",
              onAction: () => vm.selectMission(item.missionId),
            }))} />
          )}
          center={mission == null ? <p>No Mission available.</p> : (
            <div style={{ display: "grid", gap: 12 }}>
              <KeyValueTable rows={[
                { key: "Mission", value: mission.missionId },
                { key: "Objective", value: mission.objective },
                { key: "Owner", value: mission.ownerPrincipalId },
                { key: "Domain", value: mission.domainId ?? "cross-domain" },
                { key: "Budget", value: vm.budget?.status ?? "loading" },
              ]} />
              <ListCard items={vm.tasks.map((task) => ({ title: task.title, description: `${task.status} / ${task.ref}` }))} />
            </div>
          )}
          right={(
            <div style={{ display: "grid", gap: 12 }}>
              <section>
                <h3>Runs</h3>
                <ListCard items={vm.runs.map((run) => ({ title: run.title, description: run.status }))} />
              </section>
              <section>
                <h3>Evidence</h3>
                <ListCard items={vm.evidence.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` }))} />
              </section>
            </div>
          )}
        />
      )}
    </FeatureScaffold>
  );
}
