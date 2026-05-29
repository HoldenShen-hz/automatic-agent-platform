import { type ReactElement } from "react";
import type { WorkflowStepDTO } from "@aa/shared-types";
export interface DAGViewerProps {
    readonly steps: readonly WorkflowStepDTO[];
    readonly currentStage?: string;
}
export declare function DAGViewer({ steps, currentStage }: DAGViewerProps): ReactElement;
