import type { ReactElement } from "react";
import { featureRegistry } from "./feature-registry";
import { WebAppShell, type WebAppShellProps } from "./app-shell";

export interface AppProps extends Omit<WebAppShellProps, "features"> {}

export function App(props: AppProps = {}): ReactElement {
  return <WebAppShell features={featureRegistry} {...props} />;
}
