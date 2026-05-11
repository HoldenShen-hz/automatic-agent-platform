import type { ReactElement, ReactNode } from "react";
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  MemoryRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { SystemStatusBar, designTokens, type FeatureModule } from "@aa/ui-core";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import { PlatformAdapterProvider, createWebPlatformAdapter } from "@aa/shared-platform";
import { UiRuntimeProvider, useSystemStatus } from "@aa/shared-state";
import type { FeatureGuardContext } from "@aa/shared-types";
import type { RESTClient, WSClient } from "@aa/shared-api-client";

export interface AuthContext extends Partial<FeatureGuardContext> {
  readonly userId?: string;
}

export interface FeatureSubPage {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly Component: () => ReactElement;
}

interface WebFeatureModule extends FeatureModule {
  readonly subPages?: readonly FeatureSubPage[];
}

type ShellLifecyclePhase = "boot" | "auth" | "load" | "render" | "idle";

export interface WebAppShellProps {
  readonly features: readonly FeatureModule[];
  readonly client?: RESTClient;
  readonly wsClient?: WSClient;
  readonly router?: "browser" | "memory";
  readonly initialEntries?: readonly string[];
  readonly authContext?: AuthContext;
}

function AppRouter(
  { children, initialEntries, router }: { children: ReactElement; initialEntries?: readonly string[]; router: "browser" | "memory" },
): ReactElement {
  if (router === "memory") {
    return <MemoryRouter initialEntries={initialEntries == null ? ["/"] : [...initialEntries]}>{children}</MemoryRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "");
}

function AccessDeniedView({ reason }: { reason: string | null }): ReactElement {
  const navigate = useNavigate();

  return (
    <section>
      <h2>Access denied</h2>
      <p>{reason}</p>
      <button onClick={() => navigate(-1)} type="button">
        Go Back
      </button>
    </section>
  );
}

class FeatureErrorBoundary extends React.Component<
  { readonly children: ReactNode },
  { readonly error: Error | null; readonly retryKey: number }
> {
  public constructor(props: { readonly children: ReactNode }) {
    super(props);
    this.state = { error: null, retryKey: 0 };
  }

  public static getDerivedStateFromError(error: Error) {
    return { error, retryKey: 0 };
  }

  public override render(): ReactNode {
    if (this.state.error != null) {
      return (
        <section>
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => {
                this.setState((current) => ({
                  error: null,
                  retryKey: current.retryKey + 1,
                }));
              }}
              type="button"
            >
              Retry
            </button>
            <button
              onClick={() => {
                console.error("ui.feature_render_error", this.state.error);
              }}
              type="button"
            >
              Report Issue
            </button>
          </div>
        </section>
      );
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

function FeatureContent({ feature }: { feature: WebFeatureModule }): ReactElement {
  const location = useLocation();
  const subPages = feature.subPages ?? [];

  if (subPages.length === 0) {
    return (
      <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>Loading...</div>}>
        <feature.Component />
      </Suspense>
    );
  }

  const basePath = normalizePath(feature.route.path);
  const activeSubPage = subPages.find((subPage) => normalizePath(location.pathname) === `${basePath}/${subPage.path}`) ?? subPages[0]!;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>Loading...</div>}>
        <feature.Component />
      </Suspense>
      <nav aria-label={`${feature.manifest.title} sections`} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {subPages.map((subPage) => (
          <NavLink
            key={subPage.id}
            style={({ isActive }) => ({
              color: isActive ? designTokens.color.accent : designTokens.color.text,
              textDecoration: "none",
              padding: "8px 10px",
              borderRadius: 10,
              background: isActive ? "#12201a" : "transparent",
            })}
            to={`${feature.route.path}/${subPage.path}`}
          >
            {subPage.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>Loading...</div>}>
        <activeSubPage.Component />
      </Suspense>
    </div>
  );
}

function GuardedFeatureRoute(
  { features, feature, authContext }: { features: readonly WebFeatureModule[]; feature: WebFeatureModule; authContext: FeatureGuardContext },
): ReactElement {
  const resolvedFeature = features.find((candidate) => candidate.route.path === feature.route.path) ?? features[0]!;
  const guard = useMemo(() => createRouteGuardChain(
    resolvedFeature.route.permission,
    resolvedFeature.manifest.kind === "planned" ? resolvedFeature.manifest.id : undefined,
  ), [
    resolvedFeature.manifest.id,
    resolvedFeature.manifest.kind,
    resolvedFeature.route.path,
    resolvedFeature.route.permission,
  ]);
  const result = guard.evaluate(authContext);

  if (!result.allowed) {
    return <AccessDeniedView reason={result.reason} />;
  }

  return (
    <FeatureErrorBoundary>
      <FeatureContent feature={resolvedFeature} />
    </FeatureErrorBoundary>
  );
}

function AppFrame(
  { features, authContext, phase }: { features: readonly WebFeatureModule[]; authContext: FeatureGuardContext; phase: ShellLifecyclePhase },
): ReactElement {
  const systemStatus = useSystemStatus();
  const groupedFeatures = Object.entries(
    features.reduce<Record<string, WebFeatureModule[]>>((groups, feature) => {
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
        <div style={{ color: designTokens.color.subtle, fontSize: 12, marginBottom: 16, textTransform: "uppercase" }}>
          Shell phase: {phase}
        </div>
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
        {(phase === "render" || phase === "idle") ? (
          <Routes>
            {features.map((feature) => (
              <Route
                key={feature.manifest.id}
                element={<GuardedFeatureRoute authContext={authContext} feature={feature} features={features} />}
                path={feature.subPages != null && feature.subPages.length > 0 ? `${feature.route.path}/*` : feature.route.path}
              />
            ))}
            <Route element={<GuardedFeatureRoute authContext={authContext} feature={features[0]!} features={features} />} path="*" />
          </Routes>
        ) : (
          <section>
            <h2>Preparing shell</h2>
            <p>{phase}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export function WebAppShell({ features, client, wsClient, router = "browser", initialEntries, authContext }: WebAppShellProps): ReactElement {
  const runtimeProps = {
    ...(client == null ? {} : { client }),
    ...(wsClient == null ? {} : { wsClient }),
  };
  const adapter = useMemo(() => createWebPlatformAdapter(), []);
  const [phase, setPhase] = useState<ShellLifecyclePhase>("boot");

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

  useLayoutEffect(() => {
    setPhase("auth");
    setPhase("load");
    setPhase("render");
  }, []);

  useEffect(() => {
    if (phase === "render") {
      setPhase("idle");
    }
  }, [phase]);

  return (
    <PlatformAdapterProvider adapter={adapter}>
      <UiRuntimeProvider {...runtimeProps}>
        <AppRouter router={router} {...(initialEntries == null ? {} : { initialEntries })}>
          <AppFrame authContext={effectiveAuthContext} features={features as readonly WebFeatureModule[]} phase={phase} />
        </AppRouter>
      </UiRuntimeProvider>
    </PlatformAdapterProvider>
  );
}
