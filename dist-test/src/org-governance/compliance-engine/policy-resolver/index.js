import { inheritPolicyLayers } from "../inheritance/index.js";
export function resolveCompliancePolicyForNode(nodes, targetNodeId, policiesByNodeId) {
    const lineage = [];
    let current = nodes.find((item) => item.orgNodeId === targetNodeId) ?? null;
    while (current != null) {
        lineage.unshift(current);
        current = current.parentOrgNodeId == null
            ? null
            : nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
    }
    const orderedLayers = lineage.flatMap((item) => policiesByNodeId[item.orgNodeId] ?? []);
    return inheritPolicyLayers(orderedLayers);
}
//# sourceMappingURL=index.js.map