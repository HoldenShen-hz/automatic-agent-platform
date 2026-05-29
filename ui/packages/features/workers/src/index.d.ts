declare const workersFeature: import("@aa/ui-core").FeatureModule;
export default workersFeature;
export { createWorkersMobileCards } from "./mobile";
export { mapWorkersToVm, useWorkersVm } from "./hooks";
export { WorkersWebView } from "./web";
