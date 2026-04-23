import type { PlatformFeatureManifest } from "@aa/shared-types";

export interface MobileScreenDescriptor {
  readonly featureId: string;
  readonly tab: "home" | "tasks" | "approvals" | "marketplace" | "more";
  readonly title: string;
}

export function createMobileScreenDescriptor(manifest: PlatformFeatureManifest, tab: MobileScreenDescriptor["tab"]): MobileScreenDescriptor {
  return {
    featureId: manifest.id,
    tab,
    title: manifest.title,
  };
}

export const mobileNavigationBaseline = [
  { tab: "home", title: "Dashboard" },
  { tab: "tasks", title: "Tasks" },
  { tab: "approvals", title: "Approvals" },
  { tab: "marketplace", title: "Marketplace" },
  { tab: "more", title: "More" },
] as const;
