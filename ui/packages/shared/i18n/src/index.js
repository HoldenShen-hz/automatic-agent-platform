import IntlMessageFormat from "intl-messageformat";
import { enUsCatalog } from "./catalogs/en-US";
import { zhCnCatalog } from "./catalogs/zh-CN";
export class TranslationService {
    catalogs = new Map();
    loaders = new Map();
    directions = new Map();
    nativeLabels = new Map();
    listeners = new Set();
    formatterCache = new Map();
    diagnosticsReporter;
    appliedDocumentSnapshot = null;
    currentLocale = "en-US";
    constructor(options = {}) {
        this.currentLocale = options.locale ?? "en-US";
        this.diagnosticsReporter = options.diagnosticsReporter ?? null;
    }
    register(catalog, registration = {}) {
        this.catalogs.set(catalog.locale, catalog);
        this.directions.set(catalog.locale, registration.direction ?? this.directions.get(catalog.locale) ?? "ltr");
        if (registration.nativeLabel != null) {
            this.nativeLabels.set(catalog.locale, registration.nativeLabel);
        }
    }
    registerLoader(locale, loader, registration = {}) {
        this.loaders.set(locale, loader);
        this.directions.set(locale, registration.direction ?? this.directions.get(locale) ?? "ltr");
        if (registration.nativeLabel != null) {
            this.nativeLabels.set(locale, registration.nativeLabel);
        }
    }
    async loadLocale(locale) {
        const existing = this.catalogs.get(locale);
        if (existing != null) {
            return existing;
        }
        const loader = this.loaders.get(locale);
        if (loader == null) {
            return null;
        }
        const catalog = await loader();
        this.register(catalog, {
            ...(this.directions.has(locale) ? { direction: this.directions.get(locale) } : {}),
            ...(this.nativeLabels.has(locale) ? { nativeLabel: this.nativeLabels.get(locale) } : {}),
        });
        return catalog;
    }
    setLocale(locale, documentRef) {
        this.currentLocale = locale;
        this.applyLocaleToDocument(documentRef);
        const direction = this.getDirection(locale);
        for (const listener of this.listeners) {
            listener(locale, direction);
        }
    }
    getLocale() {
        return this.currentLocale;
    }
    getDirection(locale = this.currentLocale) {
        return this.directions.get(locale) ?? (locale.startsWith("ar") || locale.startsWith("he") ? "rtl" : "ltr");
    }
    listSupportedLocales() {
        const locales = new Set([
            ...this.catalogs.keys(),
            ...this.loaders.keys(),
            ...this.directions.keys(),
        ]);
        return [...locales]
            .sort((left, right) => left.localeCompare(right))
            .map((locale) => ({
            locale,
            direction: this.getDirection(locale),
            ...(this.nativeLabels.has(locale) ? { nativeLabel: this.nativeLabels.get(locale) } : {}),
        }));
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    applyLocaleToDocument(documentRef) {
        const resolvedDocument = documentRef ?? (typeof document !== "undefined" ? document : undefined);
        if (resolvedDocument == null) {
            return;
        }
        if (this.appliedDocumentSnapshot?.documentRef !== resolvedDocument) {
            this.appliedDocumentSnapshot = {
                documentRef: resolvedDocument,
                previousLang: resolvedDocument.documentElement.lang,
                previousDir: resolvedDocument.documentElement.dir,
            };
        }
        resolvedDocument.documentElement.lang = this.currentLocale;
        resolvedDocument.documentElement.dir = this.getDirection(this.currentLocale);
    }
    dispose(documentRef) {
        const resolvedDocument = documentRef ?? this.appliedDocumentSnapshot?.documentRef;
        const appliedSnapshot = this.appliedDocumentSnapshot;
        if (resolvedDocument != null && appliedSnapshot?.documentRef === resolvedDocument) {
            resolvedDocument.documentElement.lang = appliedSnapshot.previousLang;
            resolvedDocument.documentElement.dir = appliedSnapshot.previousDir;
        }
        this.appliedDocumentSnapshot = null;
        this.listeners.clear();
        this.formatterCache.clear();
    }
    translate(key, locale = this.currentLocale, fallbackLocale = "en-US", values) {
        const lookup = this.lookupMessage(key, locale, fallbackLocale);
        if (lookup.value == null) {
            this.diagnosticsReporter?.onMissingTranslation?.({
                key,
                locale,
                fallbackChain: lookup.chain,
            });
            return key;
        }
        if (values == null || Object.keys(values).length === 0) {
            return lookup.value;
        }
        try {
            const formatterKey = `${locale}::${lookup.value}`;
            let formatter = this.formatterCache.get(formatterKey);
            if (formatter == null) {
                formatter = new IntlMessageFormat(lookup.value, locale);
                this.formatterCache.set(formatterKey, formatter);
            }
            return formatIntlMessage(formatter.format(values));
        }
        catch (error) {
            this.diagnosticsReporter?.onFormatError?.({
                key,
                locale,
                message: error instanceof Error ? error.message : String(error),
            });
            return lookup.value;
        }
    }
    translateMany(keys, locale = this.currentLocale, fallbackLocale = "en-US") {
        const resolved = {};
        for (const key of keys) {
            const lookup = this.lookupMessage(key, locale, fallbackLocale);
            resolved[key] = lookup.value ?? key;
            if (lookup.value == null) {
                this.diagnosticsReporter?.onMissingTranslation?.({
                    key,
                    locale,
                    fallbackChain: lookup.chain,
                });
            }
        }
        return resolved;
    }
    detectLocale(preferredLocales) {
        for (const locale of preferredLocales) {
            if (this.catalogs.has(locale)) {
                return locale;
            }
            if (this.loaders.has(locale)) {
                return locale;
            }
            const baseLanguage = locale.split("-")[0]?.trim();
            if (baseLanguage == null || baseLanguage.length === 0) {
                continue;
            }
            const matchedLocale = this.listSupportedLocales().find((item) => item.locale.split("-")[0] === baseLanguage);
            if (matchedLocale != null) {
                return matchedLocale.locale;
            }
        }
        return this.currentLocale;
    }
    lookupMessage(key, locale, fallbackLocale) {
        const chain = this.buildFallbackChain(locale, fallbackLocale);
        for (const candidate of chain) {
            const resolved = this.catalogs.get(candidate);
            const message = resolved?.messages[key];
            if (message != null) {
                return { value: message, chain };
            }
        }
        return { value: null, chain };
    }
    buildFallbackChain(locale, fallbackLocale) {
        const chain = new Set();
        const catalog = this.catalogs.get(locale);
        for (const candidate of [locale, ...(catalog?.fallbackLocales ?? []), fallbackLocale]) {
            if (candidate.trim().length > 0) {
                chain.add(candidate);
            }
        }
        return [...chain];
    }
}
export function createDefaultTranslationService() {
    const service = new TranslationService({
        locale: detectPreferredLocale(),
    });
    service.register(enUsCatalog, {
        direction: "ltr",
        nativeLabel: "English (US)",
    });
    service.register(zhCnCatalog, {
        direction: "ltr",
        nativeLabel: "简体中文",
    });
    service.registerLoader("en-US", async () => (await import("./catalogs/en-US")).enUsCatalog, {
        direction: "ltr",
        nativeLabel: "English (US)",
    });
    service.registerLoader("zh-CN", async () => (await import("./catalogs/zh-CN")).zhCnCatalog, {
        direction: "ltr",
        nativeLabel: "简体中文",
    });
    service.registerLoader("ar-SA", async () => (await import("./catalogs/ar-SA")).arSaCatalog, {
        direction: "rtl",
        nativeLabel: "العربية",
    });
    return service;
}
let sharedTranslationService = null;
export function getSharedTranslationService() {
    if (sharedTranslationService == null) {
        sharedTranslationService = createDefaultTranslationService();
    }
    return sharedTranslationService;
}
export function resetSharedTranslationService(documentRef) {
    sharedTranslationService?.dispose(documentRef);
    sharedTranslationService = null;
}
export function translateMessage(key, values) {
    const service = getSharedTranslationService();
    return service.translate(key, service.getLocale(), "en-US", values);
}
export function translateFeatureCopy(featureId) {
    const service = getSharedTranslationService();
    const defaultTitle = featureId
        .split("-")
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    const defaultSummary = `${defaultTitle || "Feature"} workspace`;
    const titleKey = `ui.feature.${featureId}.title`;
    const summaryKey = `ui.feature.${featureId}.summary`;
    const resolved = service.translateMany([titleKey, summaryKey], service.getLocale(), "en-US");
    const title = resolved[titleKey] ?? titleKey;
    const summary = resolved[summaryKey] ?? summaryKey;
    return {
        title: title === titleKey ? defaultTitle : title,
        summary: summary === summaryKey ? defaultSummary : summary,
    };
}
function detectPreferredLocale() {
    if (typeof navigator === "undefined") {
        return "en-US";
    }
    const candidates = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language,
    ].filter((value) => typeof value === "string" && value.trim().length > 0);
    return candidates[0] ?? "en-US";
}
function formatIntlMessage(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => typeof entry === "string" ? entry : String(entry)).join("");
    }
    return typeof value === "string" ? value : String(value ?? "");
}
