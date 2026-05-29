import { jsx as _jsx } from "react/jsx-runtime";
import { featureRegistry } from "./feature-registry";
import { WebAppShell } from "./app-shell";
export function App(props = {}) {
    return _jsx(WebAppShell, { features: featureRegistry, ...props });
}
