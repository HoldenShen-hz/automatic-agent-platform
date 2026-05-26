import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { TraceExplorerWebView } from "./web";

const featureCopy = translateFeatureCopy("trace-explorer");

const traceExplorerFeature = createFeatureModule({
  id: "trace-explorer",
  title: featureCopy.title,
  group: "Observability",
  path: "/observability/trace-explorer",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: featureCopy.summary,
  render: TraceExplorerWebView,
});

export default traceExplorerFeature;
export { createTraceExplorerMobileCards } from "./mobile";
export { useTraceExplorerVm } from "./hooks";
export { TraceExplorerWebView } from "./web";
