import React from "react";

interface GlobalErrorBoundaryState {
  readonly hasError: boolean;
}

export class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, GlobalErrorBoundaryState> {
  public state: GlobalErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("ui.global_error_boundary", {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main role="alert" aria-live="assertive" className="app-fallback">
          <h1>Automatic Agent Platform</h1>
          <p>The UI hit an unrecoverable error. Refresh the page or contact an operator with the current trace.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
