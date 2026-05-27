import type { ReactElement, ReactNode } from "react";
import React, { Suspense, useEffect, useMemo, useState } from "react";
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
import { translateMessage } from "@aa/shared-i18n";
import { PlatformAdapterProvider, createWebPlatformAdapter } from "@aa/shared-platform";
import { UiRuntimeProvider, useSystemStatus } from "@aa/shared-state";
import type { FeatureGuardContext } from "@aa/shared-types";
import type { RESTClient, WSClient } from "@aa/shared-api-client";
import { reportUiError } from "./ui-telemetry";

export interface AuthContext extends Partial<FeatureGuardContext> {
  readonly userId?: string;
}

export interface FeatureSubPage {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly Component: () => ReactElement;
}

type WebFeatureModule = Omit<FeatureModule, "subPages"> & {
  readonly subPages: readonly FeatureSubPage[];
};

type ShellLifecyclePhase = "render" | "idle";

export interface WebAppShellProps {
  readonly features: readonly FeatureModule[];
  readonly client?: RESTClient;
  readonly wsClient?: WSClient;
  readonly wsUrl?: string;
  readonly wsToken?: string;
  readonly router?: "browser" | "memory";
  readonly initialEntries?: readonly string[];
  readonly authContext?: AuthContext;
  readonly startupBanner?: {
    readonly tone: "warning";
    readonly title: string;
    readonly message: string;
  };
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

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace("#", "");
  const shorthand = normalized.length === 3
    ? normalized.split("").map((segment) => `${segment}${segment}`).join("")
    : normalized;
  if (shorthand.length !== 6) {
    return hexColor;
  }
  const red = Number.parseInt(shorthand.slice(0, 2), 16);
  const green = Number.parseInt(shorthand.slice(2, 4), 16);
  const blue = Number.parseInt(shorthand.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function LoadingFallback(): ReactElement {
  return (
    <div
      aria-live="polite"
      role="status"
      style={{ padding: 24, color: designTokens.color.subtle }}
    >
      {translateMessage("ui.shell.loading")}
    </div>
  );
}

function AccessDeniedView({ fallbackPath, reason }: { reason: string | null; fallbackPath: string }): ReactElement {
  const navigate = useNavigate();
  const resolvedReason = reason ?? translateMessage("ui.shell.accessDenied.reason.default");

  return (
    <section aria-live="assertive" role="alert">
      <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{translateMessage("ui.shell.accessDenied.title")}</p>
      <p>{resolvedReason}</p>
      <button
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            navigate(-1);
            return;
          }
          navigate(fallbackPath);
        }}
        type="button"
      >
        {translateMessage("ui.shell.accessDenied.back")}
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

  public override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportUiError("ui.feature_render_error", error, {
      componentStack: info.componentStack,
    });
  }

  public override render(): ReactNode {
    if (this.state.error != null) {
      return (
        <section>
          <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{translateMessage("ui.shell.featureError.title")}</p>
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
              {translateMessage("ui.shell.featureError.retry")}
            </button>
            <button
              onClick={() => {
                reportUiError("ui.feature_render_error.report_requested", this.state.error, {
                  retryKey: this.state.retryKey,
                });
              }}
              type="button"
            >
              {translateMessage("ui.shell.featureError.report")}
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
      <Suspense fallback={<LoadingFallback />}>
        <feature.Component />
      </Suspense>
    );
  }

  const basePath = normalizePath(feature.route.path);
  const activeSubPage = subPages.find((subPage) => normalizePath(location.pathname) === `${basePath}/${subPage.path}`) ?? subPages[0] ?? null;

  if (activeSubPage == null) {
    return <section><h2>{translateMessage("ui.shell.noSections")}</h2></section>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Suspense fallback={<LoadingFallback />}>
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
              background: isActive ? withAlpha(designTokens.color.accent, 0.12) : "transparent",
            })}
            to={`${feature.route.path}/${subPage.path}`}
          >
            {subPage.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<LoadingFallback />}>
        <activeSubPage.Component />
      </Suspense>
    </div>
  );
}

function GuardedFeatureRoute(
  { features, feature, authContext }: { features: readonly WebFeatureModule[]; feature: WebFeatureModule; authContext: FeatureGuardContext },
): ReactElement {
  const resolvedFeature = useMemo(
    () => features.find((candidate) => candidate.route.path === feature.route.path) ?? features[0] ?? null,
    [feature.route.path, features],
  );
  const guard = useMemo(() => {
    if (resolvedFeature == null) {
      return null;
    }
    return createRouteGuardChain(
      resolvedFeature.route.permission,
      resolvedFeature.manifest.kind === "planned" ? resolvedFeature.manifest.id : undefined,
    );
  }, [resolvedFeature]);

  if (resolvedFeature == null) {
    return <section><h2>{translateMessage("ui.shell.noFeatures")}</h2></section>;
  }
  if (guard == null) {
    return <section><h2>{translateMessage("ui.shell.noFeatures")}</h2></section>;
  }
  const result = guard.evaluate(authContext);

  if (!result.allowed) {
    return <AccessDeniedView fallbackPath={features[0]?.route.path ?? "/"} reason={result.reason} />;
  }

  return (
    <FeatureErrorBoundary>
      <FeatureContent feature={resolvedFeature} />
    </FeatureErrorBoundary>
  );
}

function AppFrame(
  {
    features,
    authContext,
    phase,
    startupBanner,
  }: {
    features: readonly WebFeatureModule[];
    authContext: FeatureGuardContext;
    phase: ShellLifecyclePhase;
    startupBanner?: WebAppShellProps["startupBanner"];
  },
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
        <h1 style={{ fontSize: 20, marginTop: 0 }}>{translateMessage("ui.app.title")}</h1>
        <div style={{ color: designTokens.color.subtle, fontSize: 12, marginBottom: 16, textTransform: "uppercase" }}>
          {translateMessage("ui.shell.phase")}: {phase}
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
                    background: isActive ? withAlpha(designTokens.color.accent, 0.12) : "transparent",
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
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${designTokens.color.accent}`,
              background: withAlpha(designTokens.color.accent, 0.16),
            }}
          >
            <strong>{startupBanner.title}</strong>
            <p style={{ marginBottom: 0 }}>{startupBanner.message}</p>
          </section>
        )}
        <SystemStatusBar status={systemStatus} />
        {(phase === "render" || phase === "idle") ? (
          features.length === 0 ? (
            <section role="status">
              <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{translateMessage("ui.shell.noFeatures")}</p>
            </section>
          ) : (
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
          )
        ) : (
          <section aria-live="polite" role="status">
            <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{translateMessage("ui.shell.preparing")}</p>
            <p>{phase}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export function WebAppShell(
  { features, client, wsClient, wsUrl, wsToken, router = "browser", initialEntries, authContext, startupBanner }: WebAppShellProps,
): ReactElement {
  const runtimeProps = {
    ...(client == null ? {} : { client }),
    ...(wsClient == null ? {} : { wsClient }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(wsToken == null ? {} : { wsToken }),
  };
  const adapter = useMemo(() => createWebPlatformAdapter(), []);
  const [phase, setPhase] = useState<ShellLifecyclePhase>("render");
  const normalizedFeatures = useMemo(() => features.map(normalizeFeatureModule), [features]);
  const locationAuthContext = useMemo(() => resolveLocationAuthContext(), []);
  const resolvedUserId = authContext?.userId ?? locationAuthContext.userId;
  const resolvedAuthenticated = authContext?.authenticated ?? true;

  const effectiveAuthContext = {
    ...createFeatureGuardContext({
      ...locationAuthContext,
      ...authContext,
      authenticated: resolvedAuthenticated,
    }),
    ...(resolvedUserId == null ? {} : { userId: resolvedUserId }),
  };
  const runtimePermissions = effectiveAuthContext.permissions ?? [];
  const runtimeRoles = effectiveAuthContext.roles ?? [];
  const runtimeAuthContext = {
    ...(resolvedUserId == null ? {} : { userId: resolvedUserId }),
    ...(effectiveAuthContext.tenantId == null ? {} : { tenantId: effectiveAuthContext.tenantId }),
    ...(runtimePermissions.length === 0 ? {} : { permissions: runtimePermissions }),
    ...(runtimeRoles.length === 0 ? {} : { roles: runtimeRoles }),
  };

  useEffect(() => {
    if (phase === "render") {
      setPhase("idle");
    }
  }, [phase]);

  return (
    <PlatformAdapterProvider adapter={adapter}>
      <UiRuntimeProvider {...runtimeProps} authContext={runtimeAuthContext}>
        <AppRouter router={router} {...(initialEntries == null ? {} : { initialEntries })}>
          <AppFrame
            authContext={effectiveAuthContext}
            features={normalizedFeatures}
            phase={phase}
            startupBanner={startupBanner}
          />
        </AppRouter>
      </UiRuntimeProvider>
    </PlatformAdapterProvider>
  );
}

function normalizeFeatureModule(feature: FeatureModule): WebFeatureModule {
  const subPages = Array.isArray(feature.subPages)
    ? feature.subPages.filter(isFeatureSubPage)
    : [];
  return { ...feature, subPages };
}

function isFeatureSubPage(value: unknown): value is FeatureSubPage {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<FeatureSubPage>;
  return typeof candidate.id === "string"
    && typeof candidate.path === "string"
    && typeof candidate.label === "string"
    && typeof candidate.Component === "function";
}

function resolveLocationAuthContext(): Partial<AuthContext> {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const permissions = readCsvParam(params, "permissions");
  const roles = readCsvParam(params, "roles");
  const userId = params.get("user_id");
  const tenantId = params.get("tenant_id");
  const domainId = params.get("domain_id");
  const mode = params.get("mode");
  const authenticated = userId != null || permissions.length > 0 || roles.length > 0;

  return {
    ...(userId == null ? {} : { userId }),
    authenticated,
    ...(tenantId == null ? {} : { tenantId }),
    ...(domainId == null ? {} : { domainId }),
    ...(permissions.length === 0 ? {} : { permissions }),
    ...(roles.length === 0 ? {} : { roles }),
    ...(mode === "solo" || mode === "enterprise" ? { mode } : {}),
  };
}

function readCsvParam(params: URLSearchParams, key: string): readonly string[] {
  const raw = params.get(key);
  if (raw == null || raw.trim().length === 0) {
    return [];
  }
  return raw.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}
