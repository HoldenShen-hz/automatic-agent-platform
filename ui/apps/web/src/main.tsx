import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./global-error-boundary";
import { createWebRuntimeClients, createWebRuntimeConfig, registerWebServiceWorker } from "./runtime";
import "../../../packages/ui-core/src/design-tokens/tokens.css";
import { reportUiError } from "./ui-telemetry";

const rootElement = document.getElementById("root");
const runtimeConfig = createWebRuntimeConfig(import.meta.env);
const runtime = createWebRuntimeClients(runtimeConfig);

if (rootElement != null) {
  void registerWebServiceWorker().catch((error) => {
    reportUiError("ui.service_worker_registration_failed", error);
  });
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <App
          client={runtime.client}
          wsClient={runtime.wsClient}
          {...(runtimeConfig.authToken == null ? {} : { wsToken: runtimeConfig.authToken })}
          {...(runtimeConfig.wsUrl == null ? {} : { wsUrl: runtimeConfig.wsUrl })}
        />
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
}
