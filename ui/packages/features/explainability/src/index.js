import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { ExplainabilityWebView } from "./web";
const featureCopy = translateFeatureCopy("explainability");
const explainabilityFeature = createFeatureModule({
    id: "explainability",
    title: featureCopy.title,
    group: "Shared",
    path: "/shared/explainability",
    permission: "authenticated",
    status: "Implemented/Partial",
    summary: featureCopy.summary,
    render: ExplainabilityWebView,
});
export default explainabilityFeature;
export { createExplainabilityMobileCards } from "./mobile";
export { useExplainabilityVm } from "./hooks";
export { ExplainabilityWebView } from "./web";
