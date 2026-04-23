import type { ReactElement } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { designTokens, type FeatureModule } from "@aa/ui-core";
import { UiRuntimeProvider } from "@aa/shared-state";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import { featureRegistry } from "./feature-registry";

const demoGuardContext = createFeatureGuardContext({
  permissions: [
    "authenticated",
    "platform_sre",
    "pack_developer+",
    "domain_admin+",
    "org_admin+",
  ],
  featureFlags: {
    analytics: true,
    "workflow-builder": true,
    "workflow-debugger": true,
    marketplace: true,
  },
});

function renderGuardedFeature(path: string): ReactElement {
  const feature = featureRegistry.find((candidate) => candidate.route.path === path) ?? featureRegistry[0]!;
  const guard = createRouteGuardChain(feature.route.permission, feature.manifest.kind === "planned" ? feature.manifest.id : undefined);
  const result = guard.evaluate(demoGuardContext);

  if (!result.allowed) {
    return (
      <section>
        <h2>Access denied</h2>
        <p>{result.reason}</p>
      </section>
    );
  }

  return <feature.Component />;
}

const groupedFeatures = Object.entries(
  featureRegistry.reduce<Record<string, FeatureModule[]>>((groups, feature) => {
    const bucket = groups[feature.manifest.group] ?? [];
    bucket.push(feature);
    groups[feature.manifest.group] = bucket;
    return groups;
  }, {}),
);

function AppShell(): ReactElement {
  return (
    <div style={{ minHeight: "100vh", background: designTokens.color.background, color: designTokens.color.text, display: "grid", gridTemplateColumns: "280px 1fr" }}>
      <aside style={{ borderRight: `1px solid ${designTokens.color.border}`, padding: 20 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>Automatic Agent Platform UI</h1>
        <nav style={{ display: "grid", gap: 16 }}>
          {groupedFeatures.map(([group, features]) => (
            <section key={group} style={{ display: "grid", gap: 8 }}>
              <div style={{ color: designTokens.color.subtle, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
                {group}
              </div>
              {features.map((feature) => (
                <NavLink
                  key={feature.manifest.id}
                  style={({ isActive }) => ({
                    color: isActive ? designTokens.color.accent : designTokens.color.text,
                    textDecoration: "none",
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: isActive ? "#12201a" : "transparent",
                  })}
                  to={feature.route.path}
                >
                  {feature.manifest.title}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
      </aside>
      <main style={{ padding: 24 }}>
        <Routes>
          {featureRegistry.map((feature) => (
            <Route key={feature.manifest.id} element={renderGuardedFeature(feature.route.path)} path={feature.route.path} />
          ))}
          <Route element={renderGuardedFeature(featureRegistry[0]!.route.path)} path="*" />
        </Routes>
      </main>
    </div>
  );
}

export function App(): ReactElement {
  return (
    <UiRuntimeProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </UiRuntimeProvider>
  );
}
