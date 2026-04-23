import { createFeatureModule } from "@aa/ui-core";
import { ExplainabilityWebView } from "./web";

const explainabilityFeature = createFeatureModule({
  id: "explainability",
  title: "Explainability",
  group: "Shared",
  path: "/shared/explainability",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "Explainability viewer 与因果链路展示。",
  render: ExplainabilityWebView,
});

export default explainabilityFeature;
export { createExplainabilityMobileCards } from "./mobile";
export { mapExplanationsToVm, useExplainabilityVm } from "./hooks";
export { ExplainabilityWebView } from "./web";
