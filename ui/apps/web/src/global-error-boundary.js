import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { translateMessage } from "@aa/shared-i18n";
import { reportUiError } from "./ui-telemetry";
export class GlobalErrorBoundary extends React.Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        reportUiError("ui.global_error_boundary", error, {
            componentStack: info.componentStack,
        });
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("main", { role: "alert", "aria-live": "assertive", className: "app-fallback", children: [_jsx("h1", { children: translateMessage("ui.globalError.title") }), _jsx("p", { children: translateMessage("ui.globalError.message") }), _jsx("button", { onClick: () => {
                            this.setState({ hasError: false });
                        }, type: "button", children: translateMessage("ui.shell.featureError.retry") })] }));
        }
        return this.props.children;
    }
}
