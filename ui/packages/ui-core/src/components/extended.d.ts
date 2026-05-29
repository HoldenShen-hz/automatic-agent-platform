import React, { type CSSProperties, type PropsWithChildren, type ReactElement, type ReactNode } from "react";
export declare function Card({ children, style }: PropsWithChildren<{
    style?: CSSProperties;
}>): ReactElement;
export declare function Panel({ title, children }: PropsWithChildren<{
    title: string;
}>): ReactElement;
export declare function SectionHeading({ eyebrow, title, description }: {
    eyebrow?: string;
    title: string;
    description?: string;
}): ReactElement;
export declare function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement;
export declare function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement;
export declare function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement;
export declare function Divider(): ReactElement;
export declare function Stack({ gap, children }: PropsWithChildren<{
    gap?: number;
}>): ReactElement;
export declare function Inline({ gap, wrap, children }: PropsWithChildren<{
    gap?: number;
    wrap?: boolean;
}>): ReactElement;
export declare function Grid({ min, children }: PropsWithChildren<{
    min?: number;
}>): ReactElement;
export declare function ProgressBar({ value, max, label }: {
    value: number;
    max?: number;
    label?: string;
}): ReactElement;
export declare function Skeleton({ width, height }: {
    width?: number | string;
    height?: number | string;
}): ReactElement;
export declare function EmptyState({ title, description, action }: {
    title: string;
    description: string;
    action?: ReactNode;
}): ReactElement;
export declare function StatCard({ label, value, delta }: {
    label: string;
    value: ReactNode;
    delta?: string;
}): ReactElement;
export declare function Breadcrumbs({ items }: {
    items: readonly {
        label: string;
        href?: string;
    }[];
}): ReactElement;
export declare function Pagination({ page, totalPages, onChange, }: {
    page: number;
    totalPages: number;
    onChange?: (page: number) => void;
}): ReactElement;
export declare function Tabs({ tabs, initialTabId, }: {
    tabs: readonly {
        id: string;
        label: string;
        panel: ReactNode;
    }[];
    initialTabId?: string;
}): ReactElement;
export declare function Accordion({ items, }: {
    items: readonly {
        id: string;
        title: string;
        content: ReactNode;
    }[];
}): ReactElement;
export declare function Tooltip({ label, children }: PropsWithChildren<{
    label: string;
}>): ReactElement;
export declare function Drawer({ open, title, onClose, children, }: PropsWithChildren<{
    open: boolean;
    title: string;
    onClose?: () => void;
}>): ReactElement | null;
export declare function Toast({ message, tone }: {
    message: string;
    tone?: "info" | "success" | "warning" | "danger";
}): ReactElement;
export declare function Kbd({ children }: PropsWithChildren): ReactElement;
export declare function CodeBlock({ code }: {
    code: string;
}): ReactElement;
export declare function DescriptionList({ rows }: {
    rows: readonly {
        term: string;
        detail: ReactNode;
    }[];
}): ReactElement;
export declare function Stepper({ steps, activeStep }: {
    steps: readonly string[];
    activeStep: number;
}): ReactElement;
export declare function Timeline({ items }: {
    items: readonly {
        id: string;
        title: string;
        description?: string;
    }[];
}): ReactElement;
export declare function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
}): ReactElement;
export declare function Callout({ tone, title, children }: PropsWithChildren<{
    tone?: "info" | "success" | "warning" | "danger";
    title: string;
}>): ReactElement;
export declare function CommandInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement;
export declare function SegmentedControl({ options, value, onChange, }: {
    options: readonly {
        value: string;
        label: string;
    }[];
    value: string;
    onChange?: (value: string) => void;
}): ReactElement;
export declare function TimelineChart({ points, }: {
    points: readonly {
        label: string;
        value: number;
        tone?: "neutral" | "accent" | "danger";
    }[];
}): ReactElement;
export declare function PieChart({ slices, }: {
    slices: readonly {
        label: string;
        value: number;
        color?: string;
    }[];
}): ReactElement;
export declare function SLACountdown({ deadline, now, }: {
    deadline: string;
    now?: number;
}): ReactElement;
export declare function FileAttachment({ files, }: {
    files: readonly {
        id: string;
        name: string;
        sizeLabel?: string;
        kind?: string;
    }[];
}): ReactElement;
export declare function DAGVisualization({ stages, }: {
    stages: readonly {
        id: string;
        label: string;
        status: "pending" | "running" | "completed" | "failed";
        items?: readonly string[];
    }[];
}): ReactElement;
