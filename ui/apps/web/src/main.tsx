import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import {
  checkWebContractVersion,
  createWebRuntimeClients,
  createWebRuntimeConfig,
  registerWebServiceWorker,
  startWebRuntimeTelemetry,
} from "./runtime";

const rootElement = document.getElementById("root");
const runtimeConfig = createWebRuntimeConfig(import.meta.env);
const runtime = createWebRuntimeClients(runtimeConfig);

if (rootElement != null) {
  void (async () => {
    void registerWebServiceWorker();
    const telemetry = startWebRuntimeTelemetry(runtimeConfig);
    if (telemetry != null) {
      const stopTelemetry = () => {
        telemetry.stop();
        window.removeEventListener("pagehide", stopTelemetry);
      };
      window.addEventListener("pagehide", stopTelemetry, { once: true });
    }
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
