import type { ReactElement } from "react";
import { FeatureScaffold, Inline, KeyValueTable, ListCard, MetricGrid, Stack, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useWorkflowDebuggerVm } from "../hooks";

export function WorkflowDebuggerWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("workflow-debugger");
  const vm = useWorkflowDebuggerVm();
  const rightItems = vm.activePanel === "timeline"
    ? vm.timelineItems
    : vm.activePanel === "failure"
      ? vm.failureItems
      : vm.activityItems.length > 0
        ? vm.activityItems
        : [{ title: "No export activity", description: "Export a live debugger snapshot to populate this pane." }];

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      {vm.loadError == null ? null : <p role="alert">{vm.loadError}</p>}
      <ThreePaneLayout
        left={(
          <Stack gap={10}>
            <h3>Recent tasks</h3>
            {vm.loading ? <p>Loading debugger scope...</p> : null}
            {vm.listItems.map((item) => (
              <button key={item.id} onClick={() => vm.selectTask(item.id)} style={{ textAlign: "left" }} type="button">
                <strong>{item.title}</strong>
                <div>{item.subtitle}</div>
              </button>
            ))}
          </Stack>
        )}
        center={vm.selectedTask == null ? <p>No task selected</p> : (
          <Stack gap={16}>
            <h3>Live debugger view</h3>
            <KeyValueTable rows={vm.detailRows} />
            <Inline>
              <button disabled={vm.pendingOperations > 0} onClick={() => { void vm.replayTimeline(); }} type="button">回放时间线</button>
              <button disabled={vm.pendingOperations > 0} onClick={() => { void vm.focusFailure(); }} type="button">定位失败阶段</button>
              <button disabled={vm.pendingOperations > 0} onClick={() => { void vm.exportDebugSnapshot(); }} type="button">导出调试快照</button>
            </Inline>
            {vm.activePanel !== "export" || vm.exportSnapshot.length === 0 ? null : (
              <pre style={{ margin: 0, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap" }}>{vm.exportSnapshot}</pre>
            )}
          </Stack>
        )}
        right={(
          <Stack gap={12}>
            <h3>{vm.activePanel === "timeline" ? "Timeline" : vm.activePanel === "failure" ? "Failure Focus" : "Export Activity"}</h3>
            <ListCard items={rightItems} />
          </Stack>
        )}
      />
    </FeatureScaffold>
  );
}
