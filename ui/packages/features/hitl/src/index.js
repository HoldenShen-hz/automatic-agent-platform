import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { HitlWebView } from "./web";
const featureCopy = translateFeatureCopy("hitl");
const hitlFeature = createFeatureModule({
    id: "hitl",
    title: featureCopy.title,
    group: "Extended",
    path: "/extended/hitl",
    permission: "authenticated",
    status: "Implemented/Partial",
    summary: featureCopy.summary,
    render: HitlWebView,
});
export default hitlFeature;
export { createHitlMobileCards } from "./mobile";
export { useHitlVm } from "./hooks";
export { HitlWebView } from "./web";
