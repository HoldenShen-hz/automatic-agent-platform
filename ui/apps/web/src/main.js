import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./global-error-boundary";
import { createWebRuntimeClients, createWebRuntimeConfig, readBootstrapAuthToken, registerWebServiceWorker, startWebRuntimeTelemetry, } from "./runtime";
import "../../../packages/ui-core/src/design-tokens/tokens.css";
import { reportUiError } from "./ui-telemetry";
const rootElement = document.getElementById("root");
if (rootElement == null) {
    const error = new Error("ui.root_element_missing");
    reportUiError("ui.root_element_missing", error);
    throw error;
}
function RuntimeBootstrap() {
    const runtimeConfig = createWebRuntimeConfig(import.meta.env);
    const authToken = readBootstrapAuthToken();
    const runtime = createWebRuntimeClients({
        ...runtimeConfig,
        ...(authToken == null ? {} : { authToken }),
    });
    React.useEffect(() => {
        const telemetry = startWebRuntimeTelemetry(runtimeConfig);
        return () => {
            telemetry?.stop();
        };
    }, [runtimeConfig]);
    React.useEffect(() => {
        void registerWebServiceWorker();
    }, []);
    return (_jsx(App, { client: runtime.client, wsClient: runtime.wsClient, ...(authToken == null ? {} : { wsToken: authToken }), ...(runtimeConfig.wsUrl == null ? {} : { wsUrl: runtimeConfig.wsUrl }) }));
}
ReactDOM.createRoot(rootElement).render(_jsx(React.StrictMode, { children: _jsx(GlobalErrorBoundary, { children: _jsx(RuntimeBootstrap, {}) }) }));
