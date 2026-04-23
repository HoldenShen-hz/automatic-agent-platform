import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import type { AppRoute, FeatureGroup, ImplementationStatus, PlatformFeatureManifest, PlatformId, SystemStatusVM } from "@aa/shared-types";
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

export function ThreePaneLayout(
  { left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode },
): ReactElement {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1.2fr) minmax(240px, 1fr)" }}>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  );
}

export function KeyValueTable({ rows }: { rows: readonly { key: string; value: ReactNode }[] }): ReactElement {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, borderBottom: `1px solid ${designTokens.color.border}`, paddingBottom: 8 }}>
          <strong style={{ color: designTokens.color.subtle }}>{row.key}</strong>
          <div style={{ color: designTokens.color.text }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SystemStatusBar({ status }: { status: SystemStatusVM }): ReactElement {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <StatusChip label="WS" value={status.wsStatus} />
      <StatusChip label="Offline Queue" value={String(status.offlineQueueSize)} />
      <StatusChip label="Sync" value={status.syncStatus} />
      <StatusChip label="Panic" value={status.panicActivated ? "active" : "normal"} accent={status.panicActivated ? "#ef4444" : designTokens.color.accent} />
    </div>
  );
}

function StatusChip({ label, value, accent }: { label: string; value: string; accent?: string }): ReactElement {
  return (
    <div style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: 999, padding: "6px 10px", color: designTokens.color.text, background: "#0b1325" }}>
      <span style={{ color: designTokens.color.subtle, marginRight: 8 }}>{label}</span>
      <strong style={{ color: accent ?? designTokens.color.text }}>{value}</strong>
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
