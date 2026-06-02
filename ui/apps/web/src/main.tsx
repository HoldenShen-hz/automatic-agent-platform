import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./global-error-boundary";
import {
  createWebRuntimeClients,
  createWebRuntimeConfig,
  readBootstrapAuthToken,
  registerWebServiceWorker,
  startWebRuntimeTelemetry,
} from "./runtime";
import "../../../packages/ui-core/src/design-tokens/tokens.css";
import { reportUiError } from "./ui-telemetry";

const rootElement = document.getElementById("root");
if (rootElement == null) {
  const error = new Error("ui.root_element_missing");
  reportUiError("ui.root_element_missing", error);
  throw error;
}

function RuntimeBootstrap(): React.ReactElement {
  const [runtimeConfig] = React.useState(() => createWebRuntimeConfig(import.meta.env));
  const [authToken] = React.useState(() => readBootstrapAuthToken());
  const [runtime] = React.useState(() => createWebRuntimeClients({
    ...runtimeConfig,
    ...(authToken == null ? {} : { authToken }),
  }));

  React.useEffect(() => {
    const telemetry = startWebRuntimeTelemetry(runtimeConfig);
    return () => {
      telemetry?.stop();
    };
  }, [runtimeConfig]);

  React.useEffect(() => {
    void registerWebServiceWorker();
  }, []);

  return (
    <App
      client={runtime.client}
      wsClient={runtime.wsClient}
      {...(authToken == null ? {} : { wsToken: authToken })}
      {...(runtimeConfig.wsUrl == null ? {} : { wsUrl: runtimeConfig.wsUrl })}
    />
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <RuntimeBootstrap />
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
