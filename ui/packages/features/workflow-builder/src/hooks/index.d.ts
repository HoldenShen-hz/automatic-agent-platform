export interface WorkflowBuilderVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
    readonly nodes: readonly {
        readonly id: string;
        readonly position: {
            readonly x: number;
            readonly y: number;
        };
        readonly data: {
            readonly label: string;
        };
        readonly type: "default";
    }[];
    readonly edges: readonly {
        readonly id: string;
        readonly source: string;
        readonly target: string;
    }[];
}
export declare function useWorkflowBuilderVm(): WorkflowBuilderVm;
