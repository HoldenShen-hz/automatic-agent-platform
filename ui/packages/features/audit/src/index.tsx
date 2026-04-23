import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "audit",
  title: "Audit",
  group: "Governance",
  path: "/governance/audit",
  permission: "org_admin+",
  status: "Implemented/Contracted",
  summary: "审计日志、变更追踪与合规导出入口。",
  render: () => (
    <FeatureScaffold title="Audit" summary="审计与追踪中心" status="Implemented/Contracted">
      <ListCard
        items={[
          { title: "Change Timeline", description: "按时间线查看配置、审批、发布与接管操作。" },
          { title: "Evidence Export", description: "导出审计证据、审批记录与执行摘要。" },
          { title: "Actor Trace", description: "追踪用户、代理与自动化动作的来源与影响面。" },
        ]}
      />
    </FeatureScaffold>
  ),
});
