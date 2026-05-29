import type { ReactElement } from "react";
import { type WebAppShellProps } from "./app-shell";
export type AppProps = Omit<WebAppShellProps, "features">;
export declare function App(props?: AppProps): ReactElement;
