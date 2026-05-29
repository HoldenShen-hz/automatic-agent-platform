import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, MemoryRouter, NavLink, Route, Routes, useLocation, useNavigate, } from "react-router-dom";
import { SystemStatusBar, designTokens } from "@aa/ui-core";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
import { translateMessage } from "@aa/shared-i18n";
import { PlatformAdapterProvider, createWebPlatformAdapter } from "@aa/shared-platform";
import { UiRuntimeProvider, useSystemStatus } from "@aa/shared-state";
import { reportUiError } from "./ui-telemetry";
function AppRouter({ children, initialEntries, router }) {
    if (router === "memory") {
        return _jsx(MemoryRouter, { initialEntries: initialEntries == null ? ["/"] : [...initialEntries], children: children });
    }
    return _jsx(BrowserRouter, { children: children });
}
function normalizePath(path) {
    const segments = [];
    for (const segment of path.split("/")) {
        if (segment.length === 0 || segment === ".") {
            continue;
        }
        if (segment === "..") {
            segments.pop();
            continue;
        }
        segments.push(segment);
    }
    return `/${segments.join("/")}`;
}
function withAlpha(hexColor, alpha) {
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
function LoadingFallback() {
    return (_jsx("div", { "aria-live": "polite", role: "status", style: { padding: 24, color: designTokens.color.subtle }, children: translateMessage("ui.shell.loading") }));
}
function AccessDeniedView({ fallbackPath, reason }) {
    const navigate = useNavigate();
    const resolvedReason = reason ?? translateMessage("ui.shell.accessDenied.reason.default");
    return (_jsxs("section", { "aria-live": "assertive", role: "alert", children: [_jsx("p", { style: { fontSize: 20, fontWeight: 700, marginBottom: 12 }, children: translateMessage("ui.shell.accessDenied.title") }), _jsx("p", { children: resolvedReason }), _jsx("button", { onClick: () => {
                    if (typeof window !== "undefined"
                        && document.referrer.length > 0
                        && new URL(document.referrer).origin === window.location.origin) {
                        navigate(-1);
                        return;
                    }
                    navigate(fallbackPath);
                }, type: "button", children: translateMessage("ui.shell.accessDenied.back") })] }));
}
class FeatureErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, retryKey: 0 };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        reportUiError("ui.feature_render_error", error, {
            componentStack: info.componentStack,
        });
    }
    render() {
        if (this.state.error != null) {
            return (_jsxs("section", { children: [_jsx("p", { style: { fontSize: 20, fontWeight: 700, marginBottom: 12 }, children: translateMessage("ui.shell.featureError.title") }), _jsx("p", { children: translateMessage("ui.globalError.message") }), _jsxs("div", { style: { display: "flex", gap: 12 }, children: [_jsx("button", { onClick: () => {
                                    this.setState((current) => ({
                                        error: null,
                                        retryKey: current.retryKey + 1,
                                    }));
                                }, type: "button", children: translateMessage("ui.shell.featureError.retry") }), _jsx("button", { onClick: () => {
                                    reportUiError("ui.feature_render_error.report_requested", this.state.error, {
                                        retryKey: this.state.retryKey,
                                    });
                                }, type: "button", children: translateMessage("ui.shell.featureError.report") })] })] }));
        }
        return _jsx(React.Fragment, { children: this.props.children }, this.state.retryKey);
    }
}
function FeatureContent({ feature }) {
    const location = useLocation();
    const subPages = useMemo(() => resolveFeatureSubPages(feature.subPages), [feature.subPages]);
    const basePath = useMemo(() => normalizePath(feature.route.path), [feature.route.path]);
    const currentPath = useMemo(() => normalizePath(location.pathname), [location.pathname]);
    const activeSubPage = useMemo(() => subPages.find((subPage) => currentPath === normalizePath(`${basePath}/${subPage.path}`)) ?? null, [basePath, currentPath, subPages]);
    const activeSubPageBackground = useMemo(() => withAlpha(designTokens.color.accent, 0.12), []);
    if (subPages.length === 0) {
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(feature.Component, {}) }));
    }
    return (_jsxs("div", { style: { display: "grid", gap: 16 }, children: [_jsx("nav", { "aria-label": `${feature.manifest.title} sections`, style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: subPages.map((subPage) => (_jsx(NavLink, { style: ({ isActive }) => ({
                        color: isActive ? designTokens.color.accent : designTokens.color.text,
                        textDecoration: "none",
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: isActive ? activeSubPageBackground : "transparent",
                    }), to: `${feature.route.path}/${subPage.path}`, children: subPage.label }, subPage.id))) }), _jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: activeSubPage == null ? _jsx(feature.Component, {}) : _jsx(activeSubPage.Component, {}) })] }));
}
function NotFoundRoute() {
    return (_jsxs("section", { role: "alert", children: [_jsx("p", { style: { fontSize: 20, fontWeight: 700, marginBottom: 12 }, children: translateMessage("ui.shell.noFeatures") }), _jsx("p", { children: "404" })] }));
}
function GuardedFeatureRoute({ features, feature, authContext }) {
    const resolvedFeature = useMemo(() => features.find((candidate) => candidate.route.path === feature.route.path) ?? features[0] ?? null, [feature.route.path, features]);
    const guard = useMemo(() => {
        if (resolvedFeature == null) {
            return null;
        }
        return createRouteGuardChain(resolvedFeature.route.permission, resolvedFeature.manifest.kind === "planned" ? resolvedFeature.manifest.id : undefined);
    }, [resolvedFeature]);
    if (resolvedFeature == null) {
        return _jsx("section", { children: _jsx("h2", { children: translateMessage("ui.shell.noFeatures") }) });
    }
    if (guard == null) {
        return _jsx("section", { children: _jsx("h2", { children: translateMessage("ui.shell.noFeatures") }) });
    }
    const result = guard.evaluate(authContext);
    if (!result.allowed) {
        return _jsx(AccessDeniedView, { fallbackPath: features[0]?.route.path ?? "/", reason: result.reason });
    }
    return (_jsx(FeatureErrorBoundary, { children: _jsx(FeatureContent, { feature: resolvedFeature }) }));
}
function AppFrame({ features, authContext, phase, startupBanner, }) {
    const systemStatus = useSystemStatus();
    const isNarrowLayout = typeof window !== "undefined" ? window.matchMedia("(max-width: 960px)").matches : false;
    const navigationTone = useMemo(() => ({
        activeBackground: withAlpha(designTokens.color.accent, 0.12),
        bannerBackground: withAlpha(designTokens.color.accent, 0.16),
    }), []);
    const groupedFeatures = Object.entries(features.reduce((groups, feature) => {
        const bucket = groups[feature.manifest.group] ?? [];
        bucket.push(feature);
        groups[feature.manifest.group] = bucket;
        return groups;
    }, {}));
    return (_jsxs("div", { style: {
            minHeight: "100vh",
            background: designTokens.color.background,
            color: designTokens.color.text,
            display: "grid",
            gridTemplateColumns: isNarrowLayout ? "minmax(0, 1fr)" : "minmax(220px, 280px) minmax(0, 1fr)",
        }, children: [_jsxs("aside", { style: { borderRight: `1px solid ${designTokens.color.border}`, padding: 20 }, children: [_jsx("h1", { style: { fontSize: 20, marginTop: 0 }, children: translateMessage("ui.app.title") }), _jsxs("div", { style: { color: designTokens.color.subtle, fontSize: 12, marginBottom: 16, textTransform: "uppercase" }, children: [translateMessage("ui.shell.phase"), ": ", phase] }), _jsx("nav", { "aria-label": "Primary navigation", style: { display: "grid", gap: 16 }, children: groupedFeatures.map(([group, groupFeatures]) => (_jsxs("section", { style: { display: "grid", gap: 8 }, children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }, children: group }), groupFeatures.map((feature) => (_jsx(NavLink, { style: ({ isActive }) => ({
                                        color: isActive ? designTokens.color.accent : designTokens.color.text,
                                        textDecoration: "none",
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        background: isActive ? navigationTone.activeBackground : "transparent",
                                    }), to: feature.route.path, children: feature.manifest.title }, feature.manifest.id)))] }, group))) })] }), _jsxs("main", { style: { padding: 24 }, children: [startupBanner == null ? null : (_jsxs("section", { role: "alert", style: {
                            marginBottom: 16,
                            padding: 16,
                            borderRadius: 12,
                            border: `1px solid ${designTokens.color.accent}`,
                            background: navigationTone.bannerBackground,
                        }, children: [_jsx("strong", { children: startupBanner.title }), _jsx("p", { style: { marginBottom: 0 }, children: startupBanner.message })] })), _jsx(SystemStatusBar, { status: systemStatus }), phase === "ready" ? (features.length === 0 ? (_jsx("section", { role: "status", children: _jsx("p", { style: { fontSize: 20, fontWeight: 700, marginBottom: 12 }, children: translateMessage("ui.shell.noFeatures") }) })) : (_jsxs(Routes, { children: [features.map((feature) => (_jsx(Route, { element: _jsx(GuardedFeatureRoute, { authContext: authContext, feature: feature, features: features }), path: feature.subPages != null && feature.subPages.length > 0 ? `${feature.route.path}/*` : feature.route.path }, feature.manifest.id))), _jsx(Route, { element: _jsx(NotFoundRoute, {}), path: "*" })] }))) : (_jsxs("section", { "aria-live": "polite", role: "status", children: [_jsx("p", { style: { fontSize: 20, fontWeight: 700, marginBottom: 12 }, children: translateMessage("ui.shell.preparing") }), _jsx("p", { children: phase })] }))] })] }));
}
export function WebAppShell({ features, client, wsClient, wsUrl, wsToken, router = "browser", initialEntries, authContext, startupBanner }) {
    const runtimeProps = {
        ...(client == null ? {} : { client }),
        ...(wsClient == null ? {} : { wsClient }),
        ...(wsUrl == null ? {} : { wsUrl }),
        ...(wsToken == null ? {} : { wsToken }),
    };
    const adapter = useMemo(() => createWebPlatformAdapter(), []);
    const [phase, setPhase] = useState("booting");
    const normalizedFeatures = useMemo(() => features.map(normalizeFeatureModule), [features]);
    const locationAuthContext = useMemo(() => resolveLocationAuthContext(), []);
    const resolvedUserId = authContext?.userId ?? locationAuthContext.userId;
    const resolvedAuthenticated = authContext?.authenticated ?? locationAuthContext.authenticated ?? false;
    const effectiveAuthContext = useMemo(() => ({
        ...createFeatureGuardContext({
            ...locationAuthContext,
            ...authContext,
            authenticated: resolvedAuthenticated,
        }),
        ...(resolvedUserId == null ? {} : { userId: resolvedUserId }),
    }), [authContext, locationAuthContext, resolvedAuthenticated, resolvedUserId]);
    const runtimePermissions = effectiveAuthContext.permissions ?? [];
    const runtimeRoles = effectiveAuthContext.roles ?? [];
    const runtimeAuthContext = {
        ...(resolvedUserId == null ? {} : { userId: resolvedUserId }),
        ...(effectiveAuthContext.tenantId == null ? {} : { tenantId: effectiveAuthContext.tenantId }),
        ...(runtimePermissions.length === 0 ? {} : { permissions: runtimePermissions }),
        ...(runtimeRoles.length === 0 ? {} : { roles: runtimeRoles }),
    };
    useEffect(() => {
        if (phase === "booting") {
            setPhase("ready");
        }
    }, [phase]);
    return (_jsx(PlatformAdapterProvider, { adapter: adapter, children: _jsx(UiRuntimeProvider, { ...runtimeProps, authContext: runtimeAuthContext, children: _jsx(AppRouter, { router: router, ...(initialEntries == null ? {} : { initialEntries }), children: _jsx(AppFrame, { authContext: effectiveAuthContext, features: normalizedFeatures, phase: phase, startupBanner: startupBanner }) }) }) }));
}
function normalizeFeatureModule(feature) {
    const subPages = resolveFeatureSubPages(feature.subPages);
    if (subPages.length === 0) {
        return feature;
    }
    return { ...feature, subPages };
}
function resolveFeatureSubPages(subPages) {
    if (!Array.isArray(subPages)) {
        return [];
    }
    return subPages.filter(isFeatureSubPage);
}
function isFeatureSubPage(value) {
    if (value == null || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return typeof candidate.id === "string"
        && typeof candidate.path === "string"
        && typeof candidate.label === "string"
        && typeof candidate.Component === "function";
}
function resolveLocationAuthContext() {
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
    const hasExplicitAuth = userId != null || permissions.length > 0 || roles.length > 0;
    const authenticated = hasExplicitAuth;
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
function readCsvParam(params, key) {
    const raw = params.get(key);
    if (raw == null || raw.trim().length === 0) {
        return [];
    }
    return raw.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}
