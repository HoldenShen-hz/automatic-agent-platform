import type { OrgNode } from "../../org-model/org-node/index.js";
import { inheritPolicyLayers, type PolicyLayer } from "../inheritance/index.js";

export interface PolicyResolutionResult {
  readonly policy: Record<string, unknown>;
  readonly denyByDefault: boolean;
  readonly [key: string]: unknown;
}

export interface PolicyResolverOrgNode {
  readonly orgNodeId: string;
  readonly parentOrgNodeId: string | null;
  readonly nodeType?: OrgNode["nodeType"] | string;
  readonly displayName?: string;
  readonly ownerUserIds?: readonly string[];
  readonly active?: boolean;
  readonly costCenter?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly effectivePolicies?: Readonly<Record<string, unknown>>;
  readonly status?: OrgNode["status"];
}

function buildCompatibilityResult(
  policy: Record<string, unknown>,
  denyByDefault: boolean,
): PolicyResolutionResult & Record<string, unknown> {
  const flattenedPolicy = {
    ...policy,
    _denyByDefault: denyByDefault,
  };
  const compatibilityResult: PolicyResolutionResult & Record<string, unknown> = {
    ...flattenedPolicy,
    policy: flattenedPolicy,
    denyByDefault,
  };
  Object.defineProperties(compatibilityResult, {
    policy: {
      value: flattenedPolicy,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    denyByDefault: {
      value: denyByDefault,
      enumerable: false,
      configurable: false,
      writable: false,
    },
  });
  return compatibilityResult;
}

export function resolveCompliancePolicyForNode(
  nodes: readonly PolicyResolverOrgNode[],
  targetNodeId: string,
  policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>,
): PolicyResolutionResult & Record<string, unknown> {
  const lineage: PolicyResolverOrgNode[] = [];
  let current = nodes.find((item) => item.orgNodeId === targetNodeId) ?? null;
  while (current != null) {
    lineage.unshift(current);
    current = current.parentOrgNodeId == null
      ? null
      : nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
  }
  const orderedLayers = lineage.flatMap((item) => policiesByNodeId[item.orgNodeId] ?? []);
  const policy = inheritPolicyLayers(orderedLayers);
  const denyByDefault = orderedLayers.length === 0;
  return buildCompatibilityResult(policy, denyByDefault);
}
