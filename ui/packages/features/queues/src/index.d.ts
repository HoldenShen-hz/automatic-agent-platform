declare const queuesFeature: import("@aa/ui-core").FeatureModule;
export default queuesFeature;
export { createQueuesMobileCards } from "./mobile";
export { mapQueuesToVm, useQueuesVm } from "./hooks";
export { QueuesWebView } from "./web";
