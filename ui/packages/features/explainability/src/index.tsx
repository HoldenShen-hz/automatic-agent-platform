import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";
import { useExplanationsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "explainability",
  title: "Explainability",
  group: "Shared",
  path: "/shared/explainability",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "Explainability viewer 与因果链路展示。",
  render: () => {
    const explanations = useExplanationsQuery().data ?? [];
    return (
      <FeatureScaffold title="Explainability" summary="Explainability viewer 与因果链路展示" status="Planned">
        <ListCard
          items={explanations.map((item) => ({
            title: `${item.title} · ${item.evidenceCount} evidence`,
            description: item.summary,
          }))}
        />
      </FeatureScaffold>
    );
  },
});
