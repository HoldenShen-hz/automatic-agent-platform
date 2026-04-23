import type { ReactElement } from "react";
import { createMobilePlatformAdapter } from "@aa/shared-platform";

export function MobileApp(): ReactElement {
  const adapter = createMobilePlatformAdapter("android");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <strong>Automatic Agent Platform Mobile Baseline</strong>
      <span>Platform: {adapter.platform}</span>
      <span>Native bridge ready: {String(typeof globalThis.__AA_MOBILE__ !== "undefined")}</span>
    </div>
  );
}
