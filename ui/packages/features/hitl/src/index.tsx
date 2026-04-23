import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "hitl",
  title: "HITL",
  group: "Extended",
  path: "/extended/hitl",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "人工介入、Inspect、Takeover、Resume 的统一入口。",
  render: () => (
    <FeatureScaffold title="HITL" summary="人工介入、Inspect、Takeover、Resume 的统一入口" status="Implemented/Partial">
      <ListCard
        items={[
          { title: "Inspect", description: "查看当前 PlanBundle、Context 和执行状态。" },
          { title: "Takeover", description: "接管执行并写入人工操作记录。" },
          { title: "Resume", description: "支持 normal、replan、supervised、abort 四种恢复模式。" },
        ]}
      />
    </FeatureScaffold>
  ),
});
