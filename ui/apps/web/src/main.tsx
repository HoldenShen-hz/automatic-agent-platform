import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./global-error-boundary";
import { createWebRuntimeClients, createWebRuntimeConfig, registerWebServiceWorker } from "./runtime";

const rootElement = document.getElementById("root");
const runtime = createWebRuntimeClients(createWebRuntimeConfig(import.meta.env));

if (rootElement != null) {
  void registerWebServiceWorker();
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <App client={runtime.client} wsClient={runtime.wsClient} />
      </GlobalErrorBoundary>
    </React.StrictMode>,
  );
}
