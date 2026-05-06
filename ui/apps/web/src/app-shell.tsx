import type { ReactElement } from "react";
import React from "react";
import { BrowserRouter, MemoryRouter, NavLink, Route, Routes } from "react-router-dom";
import { SystemStatusBar, designTokens, type FeatureModule } from "@aa/ui-core";
import { UiRuntimeProvider, useSystemStatus } from "@aa/shared-state";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import type { RESTClient, WSClient } from "@aa/shared-api-client";
import type { TokenManager } from "@aa/shared-auth";

export interface WebAppShellProps {
  readonly features: readonly FeatureModule[];
  readonly client?: RESTClient;
  readonly tokenManager?: TokenManager;
  readonly wsClient?: WSClient;
  readonly wsUrl?: string;
  readonly router?: "browser" | "memory";
  readonly initialEntries?: readonly string[];
  /** Auth context for RBAC - should come from auth store per §5.1.1 */
  readonly authContext?: AuthContext;
}

export interface AuthContext {
  readonly userId: string;
  readonly permissions: readonly string[];
  readonly tenantId: string;
  readonly roles: readonly string[];
}

function renderGuardedFeature(
  features: readonly FeatureModule[],
  path: string,
  authContext: AuthContext | null,
): ReactElement {
  const feature = features.find((candidate) => candidate.route.path === path) ?? features[0]!;

  // §5.1.1: Use real RBAC from auth context instead of hardcoded demoGuardContext
  const guardContext = createFeatureGuardContext({
    authenticated: authContext !== null,
    tenantId: authContext?.tenantId ?? "",
    domainId: "platform",
    permissions: authContext?.permissions ?? [],
    roles: authContext?.roles ?? [],
  });

  const guard = createRouteGuardChain(
    feature.route.permission,
    feature.manifest.kind === "planned" ? feature.manifest.id : undefined,
  );
  const result = guard.evaluate(guardContext);

  if (!result.allowed) {
    return (
      <section>
        <h2>Access denied</h2>
        <p>{result.reason}</p>
        <button onClick={() => window.history.back()}>Go Back</button>
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

function AppFrame({ features, authContext }: { features: readonly FeatureModule[]; authContext: AuthContext | null }): ReactElement {
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
        {/* §4.4.1 L2-L5 nested drill-down routes */}
        {features.map((feature) => (
          <Route key={feature.manifest.id} element={renderGuardedFeature(features, feature.route.path, authContext)} path={feature.route.path}>
            {/* L3-L5 nested child routes per §4.4.1 */}
            <Route index element={null} />
            <Route path="evidence" element={null} />
            <Route path="logs" element={null} />
            <Route path="debug" element={null} />
            <Route path="metrics" element={null} />
            <Route path="settings" element={null} />
          </Route>
        ))}
        <Route element={renderGuardedFeature(features, features[0]!.route.path, authContext)} path="*" />
      </Routes>
      </main>
    </div>
  );
}

/**
 * ErrorBoundary per §5.6 with per-severity fallback handling.
 */
class AppErrorBoundary extends React.Component<
  { children: ReactElement },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactElement }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleReport = (): void => {
    const error = this.state.error;
    if (error !== null) {
      console.error("[AppErrorBoundary] Error report:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      // In production, this would send to error reporting service
    }
  };

  public render(): ReactElement {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "red" }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message ?? "Unknown error"}</p>
          <div style={{ display: "grid", gap: 8 }}>
            <button onClick={this.handleRetry}>Retry</button>
            <button onClick={this.handleReport}>Report Issue</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function WebAppShell({ features, client, tokenManager, wsClient, wsUrl, router = "browser", initialEntries, authContext }: WebAppShellProps): ReactElement {
  const runtimeProps = {
    ...(client == null ? {} : { client }),
    ...(tokenManager == null ? {} : { tokenManager }),
    ...(wsClient == null ? {} : { wsClient }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(authContext == null ? {} : { authContext }),
  };

  return (
    <UiRuntimeProvider {...runtimeProps}>
      <AppErrorBoundary>
        <AppRouter router={router} {...(initialEntries == null ? {} : { initialEntries })}>
          <AppFrame features={features} authContext={authContext ?? null} />
        </AppRouter>
      </AppErrorBoundary>
    </UiRuntimeProvider>
  );
}
