import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { checkWebContractVersion, createWebRuntimeClients, createWebRuntimeConfig, registerWebServiceWorker } from "./runtime";

const rootElement = document.getElementById("root");
const runtime = createWebRuntimeClients(createWebRuntimeConfig(import.meta.env));

if (rootElement != null) {
  void (async () => {
    void registerWebServiceWorker();
    const startupBanner = await checkWebContractVersion(runtime.client);
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App
          client={runtime.client}
          tokenManager={runtime.tokenManager}
          wsClient={runtime.wsClient}
          wsUrl={runtime.wsUrl}
          startupBanner={startupBanner ?? undefined}
        />
      </React.StrictMode>,
    );
  })();
}
