import type { ReactElement } from "react";
import { BrowserRouter, MemoryRouter, NavLink, Route, Routes } from "react-router-dom";
import { SystemStatusBar, designTokens, type FeatureModule } from "@aa/ui-core";
import { UiRuntimeProvider, useSystemStatus } from "@aa/shared-state";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import type { FeatureGuardContext } from "@aa/shared-types";
import type { RESTClient, WSClient } from "@aa/shared-api-client";

export interface WebAppShellProps {
  readonly features: readonly FeatureModule[];
  readonly client?: RESTClient;
  readonly wsClient?: WSClient;
  readonly router?: "browser" | "memory";
  readonly initialEntries?: readonly string[];
  readonly authContext?: Partial<FeatureGuardContext>;
}

function renderGuardedFeature(
  features: readonly FeatureModule[],
  path: string,
  authContext: FeatureGuardContext,
): ReactElement {
  const feature = features.find((candidate) => candidate.route.path === path) ?? features[0]!;
  const guard = createRouteGuardChain(feature.route.permission, feature.manifest.kind === "planned" ? feature.manifest.id : undefined);
  const result = guard.evaluate(authContext);

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

function AppRouter(
  { children, initialEntries, router }: { children: ReactElement; initialEntries?: readonly string[]; router: "browser" | "memory" },
): ReactElement {
  if (router === "memory") {
    return <MemoryRouter initialEntries={initialEntries == null ? ["/"] : [...initialEntries]}>{children}</MemoryRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}

function AppFrame({ features, authContext }: { features: readonly FeatureModule[]; authContext: FeatureGuardContext }): ReactElement {
  const systemStatus = useSystemStatus();
  const groupedFeatures = Object.entries(
    features.reduce<Record<string, FeatureModule[]>>((groups, feature) => {
      const bucket = groups[feature.manifest.group] ?? [];
      bucket.push(feature);
      groups[feature.manifest.group] = bucket;
      return groups;
    }, {}),
  );

  return (
    <div style={{ minHeight: "100vh", background: designTokens.color.background, color: designTokens.color.text, display: "grid", gridTemplateColumns: "280px 1fr" }}>
      <aside style={{ borderRight: `1px solid ${designTokens.color.border}`, padding: 20 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>Automatic Agent Platform UI</h1>
        <nav style={{ display: "grid", gap: 16 }}>
          {groupedFeatures.map(([group, groupFeatures]) => (
            <section key={group} style={{ display: "grid", gap: 8 }}>
              <div style={{ color: designTokens.color.subtle, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
                {group}
              </div>
              {groupFeatures.map((feature) => (
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
        <SystemStatusBar status={systemStatus} />
        <Routes>
          {features.map((feature) => (
            <Route key={feature.manifest.id} element={renderGuardedFeature(features, feature.route.path, authContext)} path={feature.route.path} />
          ))}
          <Route element={renderGuardedFeature(features, features[0]!.route.path, authContext)} path="*" />
        </Routes>
      </main>
    </div>
  );
}

export function WebAppShell({ features, client, wsClient, router = "browser", initialEntries, authContext }: WebAppShellProps): ReactElement {
  const runtimeProps = {
    ...(client == null ? {} : { client }),
    ...(wsClient == null ? {} : { wsClient }),
  };

  const effectiveAuthContext = createFeatureGuardContext({
    authenticated: true,
    tenantId: "tenant-default",
    domainId: "platform",
    permissions: ["authenticated"],
    roles: ["operator"],
    featureFlags: {},
    featureVisibility: {},
    mode: "enterprise",
    ...authContext,
  });

  return (
    <UiRuntimeProvider {...runtimeProps}>
      <AppRouter router={router} {...(initialEntries == null ? {} : { initialEntries })}>
        <AppFrame features={features} authContext={effectiveAuthContext} />
      </AppRouter>
    </UiRuntimeProvider>
  );
}
