import type { PropsWithChildren, ReactElement } from "react";
import { createContext, createElement, useContext } from "react";

import type { PlatformAdapter } from "@aa/shared-types";

const PlatformAdapterContext = createContext<PlatformAdapter | null>(null);

export function PlatformAdapterProvider(
  { adapter, children }: PropsWithChildren<{ adapter: PlatformAdapter }>,
): ReactElement {
  return createElement(
    PlatformAdapterContext.Provider,
    { value: adapter },
    children,
  );
}

export function usePlatformAdapter(): PlatformAdapter {
  const adapter = useContext(PlatformAdapterContext);
  if (adapter == null) {
    throw new Error("platform.adapter_provider_missing:PlatformAdapterProvider is required");
  }
  return adapter;
}
