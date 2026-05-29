declare const incidentsFeature: import("@aa/ui-core").FeatureModule;
export default incidentsFeature;
export { createIncidentsMobileCards } from "./mobile";
export { mapIncidentsToVm, useIncidentsVm } from "./hooks";
export { IncidentsWebView } from "./web";
