import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { GlobalErrorBoundary } from "./global-error-boundary";
import {
  bootstrapLocalDevAuthSession,
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
  const [runtimeReady, setRuntimeReady] = React.useState(() =>
    authToken != null
    || runtimeConfig.authToken != null
    || runtime.tokenManager.getAccessToken() != null,
  );
  const resolvedWsToken = authToken
    ?? runtime.tokenManager.getAccessToken()
    ?? runtimeConfig.authToken
    ?? null;

  React.useEffect(() => {
    let disposed = false;
    if (runtimeReady) {
      return () => {
        disposed = true;
      };
    }
    void bootstrapLocalDevAuthSession(runtimeConfig, runtime.tokenManager).finally(() => {
      if (!disposed) {
        setRuntimeReady(true);
      }
    });
    return () => {
      disposed = true;
    };
  }, [runtime, runtimeConfig, runtimeReady]);

  React.useEffect(() => {
    const telemetry = startWebRuntimeTelemetry(runtimeConfig);
    return () => {
      telemetry?.stop();
    };
  }, [runtimeConfig]);

  React.useEffect(() => {
    void registerWebServiceWorker();
  }, []);

  if (!runtimeReady) {
    return <div>Connecting local runtime...</div>;
  }

  return (
    <App
      client={runtime.client}
      wsClient={runtime.wsClient}
      offlineQueue={runtime.offlineQueue}
      tokenManager={runtime.tokenManager}
      {...(resolvedWsToken == null ? {} : { wsToken: resolvedWsToken })}
      {...(runtimeConfig.wsUrl == null ? {} : { wsUrl: runtimeConfig.wsUrl })}
    />
  );
}

type RootWindow = Window & {
  __AA_WEB_APP_ROOT__?: ReactDOM.Root;
};

const windowWithRoot = window as RootWindow;
const appRoot = windowWithRoot.__AA_WEB_APP_ROOT__ ?? ReactDOM.createRoot(rootElement);
windowWithRoot.__AA_WEB_APP_ROOT__ = appRoot;

appRoot.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <RuntimeBootstrap />
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
