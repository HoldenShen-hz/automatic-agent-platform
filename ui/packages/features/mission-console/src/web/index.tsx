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
              description: `${item.status} / ${item.priority} / ${item.type} / policies ${item.policyRefs?.length ?? 0}`,
              actionLabel: item.missionId === vm.selectedMissionId ? "Selected" : "Open",
              onAction: () => vm.selectMission(item.missionId),
            }))} />
          )}
          center={mission == null ? <p>No Mission available.</p> : (
            <div style={{ display: "grid", gap: 12 }}>
              <KeyValueTable rows={[
                { key: "Mission", value: mission.missionId },
                { key: "Objective", value: mission.objective },
                { key: "Success", value: mission.successCriteria.join(", ") || "pending refinement" },
                { key: "Owner", value: mission.ownerPrincipalId },
                { key: "Accountable", value: mission.accountablePrincipalId ?? "not assigned" },
                { key: "Domain", value: mission.domainId ?? "cross-domain" },
                { key: "Budget", value: vm.budget?.status ?? "loading" },
                { key: "Updated", value: mission.updatedAt },
              ]} />
              <section>
                <h3>Tasks</h3>
                <ListCard items={vm.tasks.map((task) => ({ title: task.title, description: `${task.status} / ${task.ref}` }))} />
              </section>
              <section>
                <h3>Members & Permissions</h3>
                <ListCard items={vm.members.map((member) => ({
                  title: `${member.principalId} (${member.role})`,
                  description: `${member.status} / ${member.principalType} / permissions ${member.permissions.length}`,
                }))} />
              </section>
              <section>
                <h3>Knowledge & Learning</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <KeyValueTable rows={vm.knowledgeLearningSummary.map((item) => ({ key: item.key, value: item.value }))} />
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <h4>Knowledge Assets</h4>
                      <ListCard items={vm.knowledge.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` }))} />
                    </div>
                    <div>
                      <h4>Learning Records</h4>
                      <ListCard items={vm.learning.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` }))} />
                    </div>
                  </div>
                </div>
              </section>
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
              <section>
                <h3>Settings</h3>
                <KeyValueTable rows={vm.missionSettings.map((item) => ({ key: item.key, value: item.value }))} />
              </section>
              <section>
                <h3>Guardrails</h3>
                <ListCard items={vm.operatorNotices} />
              </section>
              <section>
                <h3>Actions</h3>
                <ListCard items={vm.recommendedActions} />
              </section>
            </div>
          )}
        />
      )}
    </FeatureScaffold>
  );
}
