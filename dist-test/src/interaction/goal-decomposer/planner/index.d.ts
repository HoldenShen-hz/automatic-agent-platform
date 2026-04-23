import { type DependencyEdge } from "../dependency-graph/index.js";
export declare function buildExecutionBatches(taskIds: readonly string[], edges: readonly DependencyEdge[]): string[][];
