import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "workflow-debugger",
  title: "Workflow Debugger",
  group: "Extended",
  path: "/extended/debugger",
  permission: "pack_developer+",
  status: "Planned",
  kind: "planned",
  summary: "调试器、时间线和数据流回放。",
  render: () => (
    <FeatureScaffold title="Workflow Debugger" summary="调试器、时间线和数据流回放" status="Planned">
      <ListCard
        items={[
          { title: "Execution Timeline", description: "只读时间线回放已留 seam，后续接 DebuggerService 流。" },
          { title: "OAPEFLIR Step In", description: "逐阶段面板与数据流视图已预留结构。" },
          { title: "Time Travel", description: "保持 planned 状态，等待后端调试端点稳定。" },
        ]}
      />
    </FeatureScaffold>
  ),
});
