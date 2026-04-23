import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "workflow-builder",
  title: "Workflow Builder",
  group: "Extended",
  path: "/extended/workflow-builder",
  permission: "pack_developer+",
  status: "Planned",
  kind: "planned",
  summary: "可视化工作流构建器，先通过 contract seam 与 feature gate 落位。",
  render: () => (
    <FeatureScaffold title="Workflow Builder" summary="可视化工作流构建器" status="Planned">
      <ListCard
        items={[
          { title: "Node Palette", description: "Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release" },
          { title: "Canvas", description: "React Flow seam reserved for drag, connect, validate, publish." },
          { title: "Validation", description: "Schema + policy + runtime checks surface as planned seam." },
        ]}
      />
    </FeatureScaffold>
  ),
});
