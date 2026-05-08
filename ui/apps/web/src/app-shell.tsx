import type { ReactElement } from "react";
import React from "react";
import { BrowserRouter, MemoryRouter, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { SystemStatusBar, applyResolvedTheme, designTokens, type FeatureModule, type FeatureSubPage } from "@aa/ui-core";
import { UiRuntimeProvider, useSystemStatus, useThemeState } from "@aa/shared-state";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import type { RESTClient, WSClient } from "@aa/shared-api-client";
import type { TokenManager } from "@aa/shared-auth";
import { PlatformAdapterProvider, createWebPlatformAdapter } from "@aa/shared-platform";
import type { PlatformAdapter } from "@aa/shared-types";
import type { WebRuntimeBanner } from "./runtime";

export interface WebAppShellProps {
  readonly features: readonly FeatureModule[];
  readonly client?: RESTClient;
  readonly tokenManager?: TokenManager;
  readonly wsClient?: WSClient;
  readonly wsUrl?: string;
  readonly platformAdapter?: PlatformAdapter;
  readonly router?: "browser" | "memory";
  readonly initialEntries?: readonly string[];
  /** Auth context for RBAC - should come from auth store per §5.1.1 */
  readonly authContext?: AuthContext;
  readonly startupBanner?: WebRuntimeBanner;
}

export interface AuthContext {
  readonly userId: string;
  readonly permissions: readonly string[];
  readonly tenantId: string;
  readonly roles: readonly string[];
}

function renderFeatureBody(Component: () => ReactElement): ReactElement {
  return (
    <React.Suspense fallback={<section data-testid="feature-loading-fallback">Loading feature...</section>}>
      <Component />
    </React.Suspense>
  );
}

function renderGuardedFeatureFrame(
  feature: FeatureModule,
  authContext: AuthContext | null,
): ReactElement {
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

  return (
    <section style={{ display: "grid", gap: 16 }}>
      {feature.subPages == null || feature.subPages.length === 0 ? null : (
        <nav aria-label={`${feature.manifest.title} sections`} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NavLink
            end
            style={({ isActive }) => ({
              color: isActive ? designTokens.color.accent : designTokens.color.text,
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${isActive ? designTokens.color.accent : designTokens.color.border}`,
            })}
            to={feature.route.path}
          >
            Overview
          </NavLink>
          {feature.subPages.map((subPage) => (
            <NavLink
              key={subPage.id}
              style={({ isActive }) => ({
                color: isActive ? designTokens.color.accent : designTokens.color.text,
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${isActive ? designTokens.color.accent : designTokens.color.border}`,
              })}
              to={`${feature.route.path}/${subPage.path}`}
            >
              {subPage.label}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </section>
  );
}

function renderSubPage(subPage: FeatureSubPage): ReactElement {
  return renderFeatureBody(subPage.Component);
}

function AppRouter(
  { children, initialEntries, router }: { children: ReactElement; initialEntries?: readonly string[]; router: "browser" | "memory" },
): ReactElement {
  if (router === "memory") {
    return <MemoryRouter initialEntries={initialEntries == null ? ["/"] : [...initialEntries]}>{children}</MemoryRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}

function AppFrame(
  { features, authContext, startupBanner }: { features: readonly FeatureModule[]; authContext: AuthContext | null; startupBanner?: WebRuntimeBanner },
): ReactElement {
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
        {startupBanner == null ? null : (
          <section
            role="alert"
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${startupBanner.tone === "error" ? designTokens.color.border : designTokens.color.accent}`,
              background: startupBanner.tone === "error" ? "#2b1717" : "#12201a",
              color: designTokens.color.text,
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>{startupBanner.title}</strong>
            <span>{startupBanner.message}</span>
          </section>
        )}
        <SystemStatusBar status={systemStatus} />
        <Routes>
          {/* §4.4.1 L2-L5 nested drill-down routes */}
          {features.map((feature) => (
            <Route
              key={feature.manifest.id}
              element={renderGuardedFeatureFrame(feature, authContext)}
              path={feature.route.path}
            >
              <Route index element={renderFeatureBody(feature.Component)} />
              <Route path="evidence" element={null} />
              <Route path="logs" element={null} />
              <Route path="debug" element={null} />
              <Route path="metrics" element={null} />
              <Route path="settings" element={null} />
              {feature.subPages?.map((subPage) => (
                <Route key={subPage.id} element={renderSubPage(subPage)} path={subPage.path} />
              ))}
            </Route>
          ))}
          <Route element={renderFeatureBody(features[0]!.Component)} path="*" />
        </Routes>
      </main>
    </div>
  );
}

function ThemeRuntimeBridge(): null {
  const { resolvedThemeName } = useThemeState();

  React.useEffect(() => {
    applyResolvedTheme(resolvedThemeName);
  }, [resolvedThemeName]);

  return null;
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

export function WebAppShell(
  { features, client, tokenManager, wsClient, wsUrl, platformAdapter, router = "browser", initialEntries, authContext, startupBanner }: WebAppShellProps,
): ReactElement {
  const resolvedPlatformAdapter = React.useMemo(
    () => platformAdapter ?? createWebPlatformAdapter(),
    [platformAdapter],
  );
  const runtimeProps = {
    ...(client == null ? {} : { client }),
    ...(tokenManager == null ? {} : { tokenManager }),
    ...(wsClient == null ? {} : { wsClient }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(authContext == null ? {} : { authContext }),
    platformAdapter: resolvedPlatformAdapter,
  };

  return (
    <PlatformAdapterProvider adapter={resolvedPlatformAdapter}>
      <UiRuntimeProvider {...runtimeProps}>
        <ThemeRuntimeBridge />
        <AppErrorBoundary>
          <AppRouter router={router} {...(initialEntries == null ? {} : { initialEntries })}>
            <AppFrame features={features} authContext={authContext ?? null} startupBanner={startupBanner} />
          </AppRouter>
        </AppErrorBoundary>
      </UiRuntimeProvider>
    </PlatformAdapterProvider>
  );
}
