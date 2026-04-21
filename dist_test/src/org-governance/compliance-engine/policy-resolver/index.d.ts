import type { OrgNode } from "../../org-model/org-node/index.js";
import { type PolicyLayer } from "../inheritance/index.js";
export declare function resolveCompliancePolicyForNode(nodes: readonly OrgNode[], targetNodeId: string, policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>): Record<string, unknown>;
