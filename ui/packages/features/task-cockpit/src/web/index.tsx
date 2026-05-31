import { useMemo, useState, type ReactElement } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useTaskCockpitVm } from "../hooks";

type DrillTab = "steps" | "evidence" | "timeline";

function sanitizeInput(value: string, fallback: string): string {
  const normalized = value.replace(/[^a-z0-9-]/gi, "");
  return normalized.length > 0 ? normalized : fallback;
}

export function TaskCockpitWebView(): ReactElement {
  const vm = useTaskCockpitVm();
  const featureCopy = translateFeatureCopy("task-cockpit");
  const [operator, setOperator] = useState("platform-sre");
  const [target, setTarget] = useState("domain-admin");
  const [activeTab, setActiveTab] = useState<DrillTab>("steps");

  const selectedTask = vm.selectedTask;
  const detailRows = useMemo(() => {
    if (selectedTask == null) {
      return [];
    }
    return [
      { key: translateMessage("ui.taskCockpit.field.task"), value: selectedTask.title },
      { key: translateMessage("ui.taskCockpit.field.status"), value: selectedTask.status },
      { key: translateMessage("ui.taskCockpit.field.owner"), value: selectedTask.owner ?? translateMessage("ui.taskCockpit.value.unassigned") },
      { key: translateMessage("ui.taskCockpit.field.currentStep"), value: selectedTask.currentStep },
      { key: translateMessage("ui.taskCockpit.field.domain"), value: selectedTask.domainId },
      { key: translateMessage("ui.taskCockpit.field.evidence"), value: String(selectedTask.evidenceCount ?? 0) },
      { key: translateMessage("ui.taskCockpit.field.cpu"), value: `${selectedTask.resourceUsage?.cpuPercent ?? 0}%` },
      { key: translateMessage("ui.taskCockpit.field.memory"), value: `${selectedTask.resourceUsage?.memoryMb ?? 0} MB` },
      { key: translateMessage("ui.taskCockpit.field.runtime"), value: `${selectedTask.resourceUsage?.runtimeMinutes ?? 0} min` },
    ];
  }, [selectedTask]);

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Contracted">
      <ThreePaneLayout
        left={(
          <div>
            <h3>{translateMessage("ui.taskCockpit.listTitle")}</h3>
            <Stack gap={10}>
              {vm.listItems.map((task) => (
                <button
                  key={task.id}
                  onClick={() => vm.selectTask(task.id)}
                  style={{ textAlign: "left" }}
                  type="button"
                >
                  <strong>{task.title}</strong>
                  <div>{task.subtitle}</div>
                </button>
              ))}
            </Stack>
          </div>
        )}
        center={selectedTask == null ? <p>{translateMessage("ui.taskCockpit.noTask")}</p> : (
          <Stack gap={16}>
            <h3>{translateMessage("ui.taskCockpit.detailTitle")}</h3>
            <KeyValueTable rows={detailRows} />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void vm.claimTask(sanitizeInput(operator, "platform-sre"));
              }}
            >
              <Inline>
              <input
                aria-label={translateMessage("ui.taskCockpit.operatorInput")}
                name="operator-id"
                onChange={(event) => setOperator(event.target.value)}
                placeholder={translateMessage("ui.taskCockpit.operatorPlaceholder")}
                value={operator}
              />
              <button type="submit">{translateMessage("ui.taskCockpit.takeOver")}</button>
              <button onClick={() => { void vm.pauseTask(); }} type="button">{translateMessage("ui.taskCockpit.pause")}</button>
              <button onClick={() => { void vm.cancelTask(); }} type="button">{translateMessage("ui.taskCockpit.cancel")}</button>
              <button onClick={() => { void vm.retryTask(); }} type="button">{translateMessage("ui.taskCockpit.retry")}</button>
              <button onClick={() => { void vm.resumeTask("normal"); }} type="button">{translateMessage("ui.taskCockpit.resume")}</button>
              <button onClick={() => { void vm.resumeTask("supervised"); }} type="button">{translateMessage("ui.taskCockpit.supervisedResume")}</button>
              </Inline>
            </form>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void vm.escalateTask(sanitizeInput(target, "domain-admin"));
              }}
            >
              <Inline>
              <input
                aria-label={translateMessage("ui.taskCockpit.targetInput")}
                name="target-id"
                onChange={(event) => setTarget(event.target.value)}
                placeholder={translateMessage("ui.taskCockpit.targetPlaceholder")}
                value={target}
              />
              <button type="submit">{translateMessage("ui.taskCockpit.escalate")}</button>
              </Inline>
            </form>
          </Stack>
        )}
        right={selectedTask == null ? <p>{translateMessage("ui.taskCockpit.noTimeline")}</p> : (
          <Stack>
            <h3>{translateMessage("ui.taskCockpit.drillTitle")}</h3>
            <Inline>
              <button onClick={() => setActiveTab("steps")} type="button">{translateMessage("ui.taskCockpit.stepsTab")}</button>
              <button onClick={() => setActiveTab("evidence")} type="button">{translateMessage("ui.taskCockpit.evidenceTab")}</button>
              <button onClick={() => setActiveTab("timeline")} type="button">{translateMessage("ui.taskCockpit.timelineTab")}</button>
            </Inline>
            {activeTab === "steps" ? (
              <ListCard
                items={vm.stepViewer.steps.map((step) => ({
                  title: step.title,
                  description: `${step.status} · ${step.executor ?? translateMessage("ui.taskCockpit.value.unknown")}`,
                }))}
              />
            ) : null}
            {activeTab === "evidence" ? (
              <ListCard
                items={vm.evidenceViewer.evidenceChain.map((item) => ({
                  title: item.type,
                  description: item.description,
                }))}
              />
            ) : null}
            {activeTab === "timeline" ? (
              <ListCard
                items={vm.timelineViewer.timelineEvents.map((item) => ({
                  title: item.title,
                  description: item.description,
                }))}
              />
            ) : null}
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
