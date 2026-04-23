import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";
import { useApprovalsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "approval",
  title: "Approval Center",
  group: "Mission Control",
  path: "/mission-control/approvals",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "审批中心，支持风险摘要和人工决策入口。",
  render: () => {
    const query = useApprovalsQuery();
    return (
      <FeatureScaffold title="Approval Center" summary="审批队列与快捷动作" status="Implemented/Contracted">
        <ListCard
          items={(query.data ?? []).map((approval) => ({
            title: `${approval.taskId} · ${approval.riskLevel}`,
            description: approval.reasonSummary,
          }))}
        />
      </FeatureScaffold>
    );
  },
});
