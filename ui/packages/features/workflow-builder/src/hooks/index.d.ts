import type { WorkflowBuilderDraftDTO, WorkflowDTO } from "@aa/shared-types";
export interface WorkflowBuilderVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
    readonly drafts: readonly {
        draftId: string;
        title: string;
        updatedAt: string;
    }[];
    readonly selectedDraftId: string | null;
    readonly draftTitle: string;
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
    readonly validationMessages: readonly string[];
    readonly statusMessage: string | null;
    readonly isMutating: boolean;
    readonly canSave: boolean;
    readonly canDelete: boolean;
    setSelectedDraftId(draftId: string): void;
    setDraftTitle(value: string): void;
    createDraft(): Promise<void>;
    saveDraft(): Promise<void>;
    deleteDraft(): Promise<void>;
}
export declare function buildWorkflowBuilderSeed(workflows: readonly WorkflowDTO[]): WorkflowBuilderDraftDTO["builder"];
export declare function useWorkflowBuilderVm(): WorkflowBuilderVm;
