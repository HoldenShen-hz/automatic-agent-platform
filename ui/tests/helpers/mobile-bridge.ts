import type { MobileBridge } from "@aa/shared-platform";

export function mobileGlobals(): typeof globalThis & { __AA_MOBILE__?: MobileBridge } {
  return globalThis as typeof globalThis & { __AA_MOBILE__?: MobileBridge };
}
