import { type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import type { ImplementationStatus } from "@aa/shared-types";
export { CodeBlock, DAGVisualization, FileAttachment, Timeline } from "./extended";
export { Inline, LayoutFrame, Stack, ThreePaneLayout } from "../layouts";
export declare function StatusPill({ status }: {
    status: ImplementationStatus;
}): ReactElement;
export declare function ListCard({ items }: {
    items: readonly {
        title: string;
        description: string;
    }[];
}): ReactElement;
export declare function KeyValueTable({ rows }: {
    rows: readonly {
        key: string;
        value: ReactNode;
    }[];
}): ReactElement;
export declare function FeatureScaffold({ title, summary, status, children }: PropsWithChildren<{
    title: string;
    summary: string;
    status: ImplementationStatus;
}>): ReactElement;
export interface FeatureWorkbenchItem {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly detailRows?: readonly {
        key: string;
        value: ReactNode;
    }[];
}
export interface FeatureWorkbenchAction {
    readonly id: string;
    readonly label: string;
    readonly tone?: "accent" | "danger" | "neutral";
    readonly buildActivity?: (item: FeatureWorkbenchItem | null) => {
        title: string;
        description: string;
    };
    readonly onTrigger?: (item: FeatureWorkbenchItem | null) => void | Promise<void>;
}
export interface FeatureWorkbenchPanelItem {
    readonly id?: string;
    readonly title: string;
    readonly description: string;
    readonly detailRows?: readonly {
        key: string;
        value: ReactNode;
    }[];
}
export interface FeatureWorkbenchPanelAction {
    readonly id: string;
    readonly label: string;
    readonly tone?: "accent" | "danger" | "neutral";
    readonly activityDescription?: string;
    readonly onTrigger?: (item: FeatureWorkbenchItem | null) => void | Promise<void>;
}
export declare function buildWorkbenchActionHandler(scope: string, actionId: string, options?: {
    readonly copySelection?: boolean;
    readonly deepLinkPath?: string | ((item: FeatureWorkbenchItem | null) => string | null);
}): (item: FeatureWorkbenchItem | null) => Promise<void>;
export interface FeatureWorkbenchLabels {
    readonly filterLabel: string;
    readonly filterPlaceholder: string;
    readonly emptyState: string;
    readonly activityLogTitle: string;
    readonly activityLogEmpty: string;
}
export declare function FeatureWorkbench({ metrics, rows, items, actions, emptyState, labels, }: {
    metrics?: readonly {
        label: string;
        value: string | number;
    }[];
    rows?: readonly {
        key: string;
        value: ReactNode;
    }[];
    items: readonly FeatureWorkbenchItem[];
    actions: readonly FeatureWorkbenchAction[];
    emptyState?: string;
    labels?: Partial<FeatureWorkbenchLabels>;
}): ReactElement;
export declare function FeatureWorkbenchPanel({ metrics, rows, items, actions, emptyState, labels, }: {
    metrics?: readonly {
        label: string;
        value: string | number;
    }[];
    rows?: readonly {
        key: string;
        value: ReactNode;
    }[];
    items?: readonly FeatureWorkbenchPanelItem[];
    actions: readonly FeatureWorkbenchPanelAction[];
    emptyState?: string;
    labels?: Partial<FeatureWorkbenchLabels>;
}): ReactElement;
