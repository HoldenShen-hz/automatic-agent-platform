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
  const [taskInput, setTaskInput] = useState("");
  const [taskDomain, setTaskDomain] = useState("platform");
  const [taskOwner, setTaskOwner] = useState("platform-sre");
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrillTab>("steps");

  const selectedTask = vm.selectedTask;
  const evidenceCount = vm.evidenceViewer.evidenceChain.length > 0
    ? vm.evidenceViewer.evidenceChain.length
    : (selectedTask?.evidenceCount ?? 0);
  const detailRows = useMemo(() => {
    if (selectedTask == null) {
      return [];
    }
    const modelLabel = selectedTask.modelProvider == null && selectedTask.modelName == null
      ? translateMessage("ui.taskCockpit.value.unknown")
      : `${selectedTask.modelProvider ?? "unknown"} / ${selectedTask.modelName ?? "unknown"}`;
    return [
      { key: translateMessage("ui.taskCockpit.field.task"), value: selectedTask.title },
      { key: translateMessage("ui.taskCockpit.field.status"), value: selectedTask.status },
      { key: translateMessage("ui.taskCockpit.field.owner"), value: selectedTask.owner ?? translateMessage("ui.taskCockpit.value.unassigned") },
      { key: translateMessage("ui.taskCockpit.field.currentStep"), value: selectedTask.currentStep },
      { key: translateMessage("ui.taskCockpit.field.domain"), value: selectedTask.domainId },
      { key: translateMessage("ui.taskCockpit.field.executionMode"), value: selectedTask.executionMode ?? translateMessage("ui.taskCockpit.value.unknown") },
      { key: translateMessage("ui.taskCockpit.field.modelCall"), value: selectedTask.modelCallStatus ?? translateMessage("ui.taskCockpit.value.unknown") },
      { key: translateMessage("ui.taskCockpit.field.model"), value: modelLabel },
      { key: translateMessage("ui.taskCockpit.field.output"), value: selectedTask.outputSummary ?? selectedTask.outputUri ?? translateMessage("ui.taskCockpit.value.noRealOutput") },
      { key: translateMessage("ui.taskCockpit.field.evidence"), value: String(evidenceCount) },
      { key: translateMessage("ui.taskCockpit.field.cpu"), value: `${selectedTask.resourceUsage?.cpuPercent ?? 0}%` },
      { key: translateMessage("ui.taskCockpit.field.memory"), value: `${selectedTask.resourceUsage?.memoryMb ?? 0} MB` },
      { key: translateMessage("ui.taskCockpit.field.runtime"), value: `${selectedTask.resourceUsage?.runtimeMinutes ?? 0} min` },
    ];
  }, [evidenceCount, selectedTask]);

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Contracted">
      <form
        aria-label={translateMessage("ui.taskCockpit.createForm")}
        onSubmit={(event) => {
          event.preventDefault();
          setCreateError(null);
          void vm.createTaskFromPrompt({
            title: taskInput,
            domainId: taskDomain,
            owner: taskOwner,
          }).then(() => {
            setTaskInput("");
          }).catch((error: unknown) => {
            setCreateError(error instanceof Error ? error.message : String(error));
          });
        }}
        style={{
          border: "1px solid rgba(148, 163, 184, 0.35)",
          borderRadius: 16,
          display: "grid",
          gap: 12,
          marginBottom: 16,
          padding: 16,
        }}
      >
        <strong>{translateMessage("ui.taskCockpit.createTitle")}</strong>
        <textarea
          aria-label={translateMessage("ui.taskCockpit.createInput")}
          name="task-input"
          onChange={(event) => setTaskInput(event.target.value)}
          placeholder={translateMessage("ui.taskCockpit.createPlaceholder")}
          rows={3}
          value={taskInput}
        />
        <Inline>
          <input
            aria-label={translateMessage("ui.taskCockpit.createDomain")}
            name="task-domain"
            onChange={(event) => setTaskDomain(event.target.value)}
            placeholder={translateMessage("ui.taskCockpit.createDomainPlaceholder")}
            value={taskDomain}
          />
          <input
            aria-label={translateMessage("ui.taskCockpit.createOwner")}
            name="task-owner"
            onChange={(event) => setTaskOwner(event.target.value)}
            placeholder={translateMessage("ui.taskCockpit.createOwnerPlaceholder")}
            value={taskOwner}
          />
          <button disabled={taskInput.trim().length === 0 || vm.pendingOperations > 0} type="submit">
            {translateMessage("ui.taskCockpit.createSubmit")}
          </button>
        </Inline>
        {createError == null ? null : <p role="alert">{createError}</p>}
      </form>
      {vm.loadError == null ? null : (
        <div
          role="alert"
          style={{
            border: "1px solid rgba(239, 68, 68, 0.45)",
            borderRadius: 12,
            display: "grid",
            gap: 8,
            marginBottom: 16,
            padding: 12,
          }}
        >
          <strong>Task query failed</strong>
          <span>{vm.loadError}</span>
          <Inline>
            <button onClick={() => { void vm.refreshTasks(); }} type="button">Retry task load</button>
          </Inline>
        </div>
      )}
      <ThreePaneLayout
        left={(
          <div>
            <h3>{translateMessage("ui.taskCockpit.listTitle")}</h3>
            <Stack gap={10}>
              {vm.loading ? <p>Loading tasks...</p> : null}
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
