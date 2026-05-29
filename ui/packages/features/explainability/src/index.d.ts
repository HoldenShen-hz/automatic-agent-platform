declare const explainabilityFeature: import("@aa/ui-core").FeatureModule;
export default explainabilityFeature;
export { createExplainabilityMobileCards } from "./mobile";
export { mapExplanationsToVm, useExplainabilityVm } from "./hooks";
export { ExplainabilityWebView } from "./web";
