import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./global-error-boundary";
import { createWebRuntimeClients, createWebRuntimeConfig, registerWebServiceWorker } from "./runtime";

const rootElement = document.getElementById("root");
const runtimeConfig = createWebRuntimeConfig(import.meta.env);
const runtime = createWebRuntimeClients(runtimeConfig);

if (rootElement != null) {
  void registerWebServiceWorker();
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
