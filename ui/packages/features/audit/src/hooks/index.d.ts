export interface AuditVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useAuditVm(): AuditVm;
