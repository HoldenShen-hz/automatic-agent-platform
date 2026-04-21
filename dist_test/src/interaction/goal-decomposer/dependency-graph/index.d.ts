export interface DependencyEdge {
    readonly fromTask: string;
    readonly toTask: string;
}
export declare function detectDependencyCycle(taskIds: readonly string[], edges: readonly DependencyEdge[]): boolean;
export declare function topologicallySortTaskIds(taskIds: readonly string[], edges: readonly DependencyEdge[]): string[];
