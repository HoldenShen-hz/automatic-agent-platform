import type { OrgNode, OrgChangeEvent } from "../org-node/index.js";
export declare function validateOrgHierarchy(nodes: readonly OrgNode[]): string[];
export declare function listAncestorNodeIds(nodes: readonly OrgNode[], nodeId: string): string[];
/**
 * Lists all descendant node IDs of a given node.
 */
export declare function listDescendantNodeIds(nodes: readonly OrgNode[], nodeId: string): string[];
/**
 * Finds the root node (company level) in the org chart.
 */
export declare function findRootNode(nodes: readonly OrgNode[]): OrgNode | null;
/**
 * Gets all nodes at a specific level in the hierarchy.
 */
export declare function getNodesAtLevel(nodes: readonly OrgNode[], level: number): OrgNode[];
/**
 * Calculates the depth of a node in the hierarchy (root = 0).
 */
export declare function getNodeDepth(nodes: readonly OrgNode[], nodeId: string): number;
/**
 * Finds the lowest common ancestor of two nodes.
 */
export declare function findLowestCommonAncestor(nodes: readonly OrgNode[], nodeId1: string, nodeId2: string): string | null;
/**
 * Builds a reporting chain for an employee.
 */
export declare function buildReportingChain(nodes: readonly OrgNode[], employeeId: string, memberNodeId: string): string[];
/**
 * Determines the org change events that would result from a proposed restructure.
 */
export declare function detectOrgChangeEvents(before: readonly OrgNode[], after: readonly OrgNode[]): OrgChangeEvent[];
