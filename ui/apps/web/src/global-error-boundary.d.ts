import React from "react";
interface GlobalErrorBoundaryState {
    readonly hasError: boolean;
}
export declare class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, GlobalErrorBoundaryState> {
    state: GlobalErrorBoundaryState;
    static getDerivedStateFromError(): GlobalErrorBoundaryState;
    componentDidCatch(error: Error, info: React.ErrorInfo): void;
    render(): React.ReactNode;
}
export {};
