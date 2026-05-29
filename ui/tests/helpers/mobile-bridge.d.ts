import type { MobileBridge } from "@aa/shared-platform";
export declare function mobileGlobals(): typeof globalThis & {
    __AA_MOBILE__?: MobileBridge;
};
