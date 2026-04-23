import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";
import { useCostReportsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "cost-center",
  title: "Cost Center",
  group: "Shared",
  path: "/shared/costs",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "成本中心与预算视图。",
  render: () => {
    const reports = useCostReportsQuery().data ?? [];
    return (
      <FeatureScaffold title="Cost Center" summary="成本中心与预算视图" status="Planned">
        <ListCard
          items={reports.map((report) => ({
            title: `${report.scope} · $${report.amountUsd}`,
            description: `Budget $${report.budgetUsd}`,
          }))}
        />
      </FeatureScaffold>
    );
  },
});
