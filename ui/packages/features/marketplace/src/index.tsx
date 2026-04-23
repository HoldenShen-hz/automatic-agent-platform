import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";
import { useMarketplaceQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "marketplace",
  title: "Marketplace",
  group: "Shared",
  path: "/shared/marketplace",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "Marketplace 列表、详情和安装流程。",
  render: () => {
    const packs = useMarketplaceQuery().data ?? [];
    return (
      <FeatureScaffold title="Marketplace" summary="Marketplace 列表、详情和安装流程" status="Planned">
        <ListCard
          items={packs.map((pack) => ({
            title: `${pack.name} · ${pack.version}`,
            description: pack.category,
          }))}
        />
      </FeatureScaffold>
    );
  },
});
