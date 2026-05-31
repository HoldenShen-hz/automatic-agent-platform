import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useMissionConsoleVm } from "../hooks";

export function MissionConsoleWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("mission-console");
  const vm = useMissionConsoleVm();
  const mission = vm.selectedMission;
  return (
    <FeatureScaffold
      title={featureCopy.title}
      summary={featureCopy.summary}
      status="Implemented/Contracted"
    >
      {vm.loading ? <p>{translateMessage("ui.missionConsole.loading")}</p> : (
        <ThreePaneLayout
          left={(
            <ListCard items={vm.missions.map((item) => ({
              title: item.title,
              description: `${item.status} / ${item.priority} / ${item.type} / policies ${item.policyRefs?.length ?? 0}`,
              actionLabel: item.missionId === vm.selectedMissionId ? translateMessage("ui.missionConsole.selected") : translateMessage("ui.missionConsole.open"),
              onAction: () => vm.selectMission(item.missionId),
            }))} />
          )}
          center={mission == null ? <p>{translateMessage("ui.missionConsole.noMission")}</p> : (
            <div style={{ display: "grid", gap: 12 }}>
              <KeyValueTable rows={[
                { key: translateMessage("ui.missionConsole.field.mission"), value: mission.missionId },
                { key: translateMessage("ui.missionConsole.field.objective"), value: mission.objective },
                { key: translateMessage("ui.missionConsole.field.success"), value: mission.successCriteria.join(", ") || translateMessage("ui.missionConsole.value.pendingRefinement") },
                { key: translateMessage("ui.missionConsole.field.owner"), value: mission.ownerPrincipalId },
                { key: translateMessage("ui.missionConsole.field.accountable"), value: mission.accountablePrincipalId ?? translateMessage("ui.missionConsole.value.notAssigned") },
                { key: translateMessage("ui.missionConsole.field.domain"), value: mission.domainId ?? translateMessage("ui.missionConsole.value.crossDomain") },
                { key: translateMessage("ui.missionConsole.field.budget"), value: vm.budget?.status ?? translateMessage("ui.missionConsole.value.loading") },
                { key: translateMessage("ui.missionConsole.field.updated"), value: mission.updatedAt },
              ]} />
              <section>
                <h3>{translateMessage("ui.missionConsole.section.tasks")}</h3>
                <ListCard items={vm.tasks.map((task) => ({ title: task.title, description: `${task.status} / ${task.ref}` }))} />
              </section>
              <section>
                <h3>{translateMessage("ui.missionConsole.section.members")}</h3>
                <ListCard items={vm.members.map((member) => ({
                  title: `${member.principalId} (${member.role})`,
                  description: `${member.status} / ${member.principalType} / permissions ${member.permissions.length}`,
                }))} />
              </section>
              <section>
                <h3>{translateMessage("ui.missionConsole.section.knowledgeLearning")}</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  <KeyValueTable rows={vm.knowledgeLearningSummary.map((item) => ({ key: item.key, value: item.value }))} />
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <h4>{translateMessage("ui.missionConsole.section.knowledgeAssets")}</h4>
                      <ListCard items={vm.knowledge.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` }))} />
                    </div>
                    <div>
                      <h4>{translateMessage("ui.missionConsole.section.learningRecords")}</h4>
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
                <h3>{translateMessage("ui.missionConsole.section.runs")}</h3>
                <ListCard items={vm.runs.map((run) => ({ title: run.title, description: run.status }))} />
              </section>
              <section>
                <h3>{translateMessage("ui.missionConsole.section.evidence")}</h3>
                <ListCard items={vm.evidence.map((item) => ({ title: item.title, description: `${item.status} / ${item.ref}` }))} />
              </section>
              <section>
                <h3>{translateMessage("ui.missionConsole.section.settings")}</h3>
                <KeyValueTable rows={vm.missionSettings.map((item) => ({ key: item.key, value: item.value }))} />
              </section>
              <section>
                <h3>{translateMessage("ui.missionConsole.section.guardrails")}</h3>
                <ListCard items={vm.operatorNotices} />
              </section>
              <section>
                <h3>{translateMessage("ui.missionConsole.section.actions")}</h3>
                <ListCard items={vm.recommendedActions} />
              </section>
            </div>
          )}
        />
      )}
    </FeatureScaffold>
  );
}
