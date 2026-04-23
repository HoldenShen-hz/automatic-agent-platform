import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import type { AppRoute, FeatureGroup, ImplementationStatus, PlatformFeatureManifest, PlatformId } from "@aa/shared-types";
import { createRouteGuardChain } from "@aa/shared-domain";

export interface FeatureModule {
  readonly manifest: PlatformFeatureManifest;
  readonly route: AppRoute;
  readonly Component: () => ReactElement;
}

export const designTokens = {
  color: {
    background: "#0f172a",
    surface: "#111827",
    border: "#334155",
    accent: "#22c55e",
    text: "#e5e7eb",
    subtle: "#94a3b8",
    planned: "#f59e0b",
  },
  radius: {
    md: "12px",
  },
};

export function StatusPill({ status }: { status: ImplementationStatus }): ReactElement {
  const background = status === "Planned" ? designTokens.color.planned : designTokens.color.accent;
  return <span style={{ background, borderRadius: 999, color: "#04130a", padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>{status}</span>;
}

export function LayoutFrame(
  { title, subtitle, children, aside }: PropsWithChildren<{ title: string; subtitle: string; aside?: ReactNode }>,
): ReactElement {
  return (
    <section style={{ background: designTokens.color.surface, border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.md, padding: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: designTokens.color.text }}>{title}</h2>
          <p style={{ margin: "8px 0 0", color: designTokens.color.subtle }}>{subtitle}</p>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function MetricGrid({ metrics }: { metrics: readonly { label: string; value: string | number }[] }): ReactElement {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
      {metrics.map((metric) => (
        <div key={metric.label} style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.md, padding: 14 }}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{metric.label}</div>
          <div style={{ color: designTokens.color.text, fontSize: 24, fontWeight: 700 }}>{metric.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ListCard({ items }: { items: readonly { title: string; description: string }[] }): ReactElement {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <article key={item.title} style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: designTokens.radius.md, padding: 14 }}>
          <div style={{ color: designTokens.color.text, fontWeight: 600 }}>{item.title}</div>
          <div style={{ color: designTokens.color.subtle, marginTop: 6 }}>{item.description}</div>
        </article>
      ))}
    </div>
  );
}

export function FeatureScaffold(
  { title, summary, status, children }: PropsWithChildren<{ title: string; summary: string; status: ImplementationStatus }>,
): ReactElement {
  return (
    <LayoutFrame title={title} subtitle={summary} aside={<StatusPill status={status} />}>
      {children}
    </LayoutFrame>
  );
}

export function createFeatureModule(config: {
  id: string;
  title: string;
  group: FeatureGroup;
  path: string;
  permission: string;
  status: ImplementationStatus;
  kind?: "implemented" | "planned";
  platforms?: readonly PlatformId[];
  apiLayer?: "A" | "B" | "C";
  summary: string;
  render?: () => ReactElement;
}): FeatureModule {
  const platforms = config.platforms ?? ["web", "windows", "macos", "linux", "android", "ios"];
  const Component = config.render ?? (() => (
    <FeatureScaffold title={config.title} summary={config.summary} status={config.status}>
      <p style={{ color: designTokens.color.text, margin: 0 }}>
        {config.kind === "planned" ? "This feature is wired through a contract seam and feature gate." : "This feature is connected to the shared UI baseline."}
      </p>
    </FeatureScaffold>
  ));

  return {
    manifest: {
      id: config.id,
      title: config.title,
      group: config.group,
      path: config.path,
      status: config.status,
      kind: config.kind ?? (config.status === "Planned" ? "planned" : "implemented"),
      platforms,
      permission: config.permission,
      apiLayer: config.apiLayer ?? "C",
      summary: config.summary,
    },
    route: {
      path: config.path,
      featureId: config.id,
      group: config.group,
      title: config.title,
      permission: config.permission,
      platforms,
      codeSplit: false,
    },
    Component,
  };
}

export function createFeatureGuard(permission: string, flag?: string) {
  return createRouteGuardChain(permission, flag);
}
