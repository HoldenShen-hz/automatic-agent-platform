import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { type ControlPlaneCapabilityBaseline } from "./control-plane/control-plane-bootstrap.js";
import { type ExecutionCapabilityBaseline } from "./execution/execution-plane-bootstrap.js";
import { type InterfaceCapabilityBaseline } from "./interface/interface-plane-bootstrap.js";
import { type OrchestrationCapabilityBaseline } from "./orchestration/orchestration-plane-bootstrap.js";
import { type StateEvidenceCapabilityBaseline } from "./state-evidence/state-evidence-plane-bootstrap.js";
export declare const FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID = "plane.runtime.catalog";
export interface FivePlaneRuntimeCatalog {
    readonly interfacePlane: readonly InterfaceCapabilityBaseline[];
    readonly controlPlane: readonly ControlPlaneCapabilityBaseline[];
    readonly orchestrationPlane: readonly OrchestrationCapabilityBaseline[];
    readonly executionPlane: readonly ExecutionCapabilityBaseline[];
    readonly stateEvidencePlane: readonly StateEvidenceCapabilityBaseline[];
}
export declare function buildFivePlaneRuntimeCatalog(): FivePlaneRuntimeCatalog;
export declare function registerFivePlaneRuntimeCatalog(registry?: ServiceRegistry): FivePlaneRuntimeCatalog;
