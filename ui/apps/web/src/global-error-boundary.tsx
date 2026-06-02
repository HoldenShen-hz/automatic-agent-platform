import React from "react";
import { translateMessage } from "@aa/shared-i18n";
import { reportUiError } from "./ui-telemetry";

interface GlobalErrorBoundaryState {
  readonly hasError: boolean;
  readonly retryKey: number;
}

export class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, GlobalErrorBoundaryState> {
  public state: GlobalErrorBoundaryState = { hasError: false, retryKey: 0 };

  public static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true, retryKey: 0 };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportUiError("ui.global_error_boundary", error, {
      componentStack: info.componentStack,
    });
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main role="alert" aria-live="assertive" className="app-fallback">
          <h1>{translateMessage("ui.globalError.title")}</h1>
          <p>{translateMessage("ui.globalError.message")}</p>
          <button
            onClick={() => {
              this.setState((current) => ({ hasError: false, retryKey: current.retryKey + 1 }));
            }}
            type="button"
          >
            {translateMessage("ui.shell.featureError.retry")}
          </button>
        </main>
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}
