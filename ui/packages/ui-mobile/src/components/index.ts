import type { PlatformFeatureManifest } from "@aa/shared-types";

export interface MobileScreenDescriptor {
  readonly featureId: string;
  readonly tab: "home" | "tasks" | "approvals" | "marketplace" | "more";
  readonly title: string;
}

export interface MobileFeatureCard {
  readonly title: string;
  readonly subtitle: string;
  readonly badge?: string;
}

export function createMobileScreenDescriptor(
  manifest: PlatformFeatureManifest,
  tab: MobileScreenDescriptor["tab"],
): MobileScreenDescriptor {
  return {
    featureId: manifest.id,
    tab,
    title: manifest.title,
  };
}

export function createMobileFeatureCard(title: string, subtitle: string, badge?: string): MobileFeatureCard {
  return badge == null ? { title, subtitle } : { title, subtitle, badge };
}
