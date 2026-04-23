import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "policy",
  title: "Policy",
  group: "Governance",
  path: "/governance/policy",
  permission: "domain_admin+",
  status: "Implemented/Contracted",
  summary: "治理策略、准入规则与审批策略矩阵。",
  render: () => (
    <FeatureScaffold title="Policy" summary="治理策略与风险门禁" status="Implemented/Contracted">
      <ListCard
        items={[
          { title: "Approval Policy", description: "按风险等级、域和租户定义审批门禁。" },
          { title: "Action Policy", description: "定义 task.cancel、workflow.publish 等动作的确认与禁止规则。" },
          { title: "Feature Visibility", description: "按角色与域控制工作台功能显隐。" },
        ]}
      />
    </FeatureScaffold>
  ),
});
