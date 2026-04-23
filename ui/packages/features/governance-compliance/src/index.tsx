import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "governance-compliance",
  title: "Governance Compliance",
  group: "Governance",
  path: "/governance/compliance",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "治理与合规视图，通过 planned seam 对齐后端增强端点。",
  render: () => (
    <FeatureScaffold title="Governance Compliance" summary="治理与合规视图" status="Planned">
      <ListCard
        items={[
          { title: "Compliance Score", description: "标准、检查项和最近审计结果通过 planned seam 呈现。" },
          { title: "Field Redaction Policy", description: "字段级可见性、PII handling 和审计访问规则。" },
          { title: "Delegated Governance", description: "域治理委托与审批升级路径。" },
        ]}
      />
    </FeatureScaffold>
  ),
});
