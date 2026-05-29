import { type PropsWithChildren, type ReactElement, type ReactNode } from "react";
export declare function Stack({ gap, children, align, }: PropsWithChildren<{
    gap?: number;
    align?: "stretch" | "start" | "center" | "end";
}>): ReactElement;
export declare function Inline({ gap, children, align, wrap, }: PropsWithChildren<{
    gap?: number;
    align?: "stretch" | "start" | "center" | "end";
    wrap?: boolean;
}>): ReactElement;
export declare function LayoutFrame({ title, subtitle, children, aside }: PropsWithChildren<{
    title: string;
    subtitle: string;
    aside?: ReactNode;
}>): ReactElement;
export declare function ThreePaneLayout({ left, center, right: rightPane }: {
    left: ReactNode;
    center: ReactNode;
    right: ReactNode;
}): ReactElement;
