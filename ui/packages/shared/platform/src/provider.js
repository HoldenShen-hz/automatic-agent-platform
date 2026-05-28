import { createContext, createElement, useContext } from "react";
const PlatformAdapterContext = createContext(null);
export function PlatformAdapterProvider({ adapter, children }) {
    return createElement(PlatformAdapterContext.Provider, { value: adapter }, children);
}
export function usePlatformAdapter() {
    const adapter = useContext(PlatformAdapterContext);
    if (adapter == null) {
        throw new Error("platform.adapter_provider_missing:PlatformAdapterProvider is required");
    }
    return adapter;
}
