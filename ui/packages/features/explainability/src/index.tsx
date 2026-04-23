import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "explainability",
  title: "Explainability",
  group: "Shared",
  path: "/shared/explainability",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "Explainability viewer 与因果链路展示。",
});
