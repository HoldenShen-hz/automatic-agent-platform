import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { MemoryReviewWebView } from "./web";

const featureCopy = translateFeatureCopy("memory-review");

const memoryReviewFeature = createFeatureModule({
  id: "memory-review",
  title: featureCopy.title,
  group: "Governance",
  path: "/governance/memory-review",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: featureCopy.summary,
  render: MemoryReviewWebView,
});

export default memoryReviewFeature;
export { createMemoryReviewMobileCards } from "./mobile";
export { useMemoryReviewVm } from "./hooks";
export { MemoryReviewWebView } from "./web";
