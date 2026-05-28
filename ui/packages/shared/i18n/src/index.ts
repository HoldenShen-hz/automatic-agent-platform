import IntlMessageFormat from "intl-messageformat";
import { enUsCatalog } from "./catalogs/en-US";
import { zhCnCatalog } from "./catalogs/zh-CN";

export interface TranslationCatalog {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
  readonly fallbackLocales?: readonly string[];
}

export type TextDirection = "ltr" | "rtl";

export interface LocaleRegistration {
  readonly fallbackLocales?: readonly string[];
  readonly direction?: TextDirection;
  readonly nativeLabel?: string;
}

export interface SupportedLocale {
  readonly locale: string;
  readonly direction: TextDirection;
  readonly nativeLabel?: string;
}

export interface FeatureTranslationCopy {
  readonly title: string;
  readonly summary: string;
}

export interface MissingTranslationEvent {
  readonly key: string;
  readonly locale: string;
  readonly fallbackChain: readonly string[];
}

export interface TranslationFormatErrorEvent {
  readonly key: string;
  readonly locale: string;
  readonly message: string;
}

export interface TranslationDiagnosticsReporter {
  onMissingTranslation?(event: MissingTranslationEvent): void;
  onFormatError?(event: TranslationFormatErrorEvent): void;
}

type CatalogLoader = () => Promise<TranslationCatalog>;
type LocaleChangeListener = (locale: string, direction: TextDirection) => void;
type DocumentRef = Pick<Document, "documentElement">;

interface AppliedDocumentSnapshot {
  readonly documentRef: DocumentRef;
  readonly previousLang: string;
  readonly previousDir: string;
}

interface TranslationLookupResult {
  readonly value: string | null;
  readonly chain: readonly string[];
}

export class TranslationService {
  private readonly catalogs = new Map<string, TranslationCatalog>();
  private readonly loaders = new Map<string, CatalogLoader>();
  private readonly directions = new Map<string, TextDirection>();
  private readonly nativeLabels = new Map<string, string>();
  private readonly listeners = new Set<LocaleChangeListener>();
  private readonly formatterCache = new Map<string, IntlMessageFormat>();
  private readonly diagnosticsReporter: TranslationDiagnosticsReporter | null;
  private appliedDocumentSnapshot: AppliedDocumentSnapshot | null = null;
  private currentLocale = "en-US";

  public constructor(options: { readonly locale?: string; readonly diagnosticsReporter?: TranslationDiagnosticsReporter | null; } = {}) {
    this.currentLocale = options.locale ?? "en-US";
    this.diagnosticsReporter = options.diagnosticsReporter ?? null;
  }

  public register(catalog: TranslationCatalog, registration: LocaleRegistration = {}): void {
    this.catalogs.set(catalog.locale, catalog);
    this.directions.set(catalog.locale, registration.direction ?? this.directions.get(catalog.locale) ?? "ltr");
    if (registration.nativeLabel != null) {
      this.nativeLabels.set(catalog.locale, registration.nativeLabel);
    }
  }

  public registerLoader(locale: string, loader: CatalogLoader, registration: LocaleRegistration = {}): void {
    this.loaders.set(locale, loader);
    this.directions.set(locale, registration.direction ?? this.directions.get(locale) ?? "ltr");
    if (registration.nativeLabel != null) {
      this.nativeLabels.set(locale, registration.nativeLabel);
    }
  }

  public async loadLocale(locale: string): Promise<TranslationCatalog | null> {
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
      ...(this.directions.has(locale) ? { direction: this.directions.get(locale)! } : {}),
      ...(this.nativeLabels.has(locale) ? { nativeLabel: this.nativeLabels.get(locale)! } : {}),
    });
    return catalog;
  }

  public setLocale(locale: string, documentRef?: DocumentRef): void {
    this.currentLocale = locale;
    this.applyLocaleToDocument(documentRef);
    const direction = this.getDirection(locale);
    for (const listener of this.listeners) {
      listener(locale, direction);
    }
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public getDirection(locale = this.currentLocale): TextDirection {
    return this.directions.get(locale) ?? (locale.startsWith("ar") || locale.startsWith("he") ? "rtl" : "ltr");
  }

  public listSupportedLocales(): readonly SupportedLocale[] {
    const locales = new Set<string>([
      ...this.catalogs.keys(),
      ...this.loaders.keys(),
      ...this.directions.keys(),
    ]);
    return [...locales]
      .sort((left, right) => left.localeCompare(right))
      .map((locale) => ({
        locale,
        direction: this.getDirection(locale),
        ...(this.nativeLabels.has(locale) ? { nativeLabel: this.nativeLabels.get(locale)! } : {}),
      }));
  }

  public subscribe(listener: LocaleChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public applyLocaleToDocument(documentRef?: DocumentRef): void {
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

  public dispose(documentRef?: DocumentRef): void {
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

  public translate(
    key: string,
    locale = this.currentLocale,
    fallbackLocale = "en-US",
    values?: Readonly<Record<string, unknown>>,
  ): string {
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
    } catch (error) {
      this.diagnosticsReporter?.onFormatError?.({
        key,
        locale,
        message: error instanceof Error ? error.message : String(error),
      });
      return lookup.value;
    }
  }

  public translateMany(
    keys: readonly string[],
    locale = this.currentLocale,
    fallbackLocale = "en-US",
  ): Readonly<Record<string, string>> {
    const resolved: Record<string, string> = {};
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

  public detectLocale(preferredLocales: readonly string[]): string {
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

  private lookupMessage(key: string, locale: string, fallbackLocale: string): TranslationLookupResult {
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

  private buildFallbackChain(locale: string, fallbackLocale: string): readonly string[] {
    const chain = new Set<string>();
    const catalog = this.catalogs.get(locale);
    for (const candidate of [locale, ...(catalog?.fallbackLocales ?? []), fallbackLocale]) {
      if (candidate.trim().length > 0) {
        chain.add(candidate);
      }
    }
    return [...chain];
  }
}

export function createDefaultTranslationService(): TranslationService {
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

let sharedTranslationService: TranslationService | null = null;

export function getSharedTranslationService(): TranslationService {
  if (sharedTranslationService == null) {
    sharedTranslationService = createDefaultTranslationService();
  }
  return sharedTranslationService;
}

export function resetSharedTranslationService(documentRef?: DocumentRef): void {
  sharedTranslationService?.dispose(documentRef);
  sharedTranslationService = null;
}

export function translateMessage(
  key: string,
  values?: Readonly<Record<string, unknown>>,
): string {
  const service = getSharedTranslationService();
  return service.translate(key, service.getLocale(), "en-US", values);
}

export function translateFeatureCopy(featureId: string): FeatureTranslationCopy {
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

function detectPreferredLocale(): string {
  if (typeof navigator === "undefined") {
    return "en-US";
  }
  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return candidates[0] ?? "en-US";
}

function formatIntlMessage(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => typeof entry === "string" ? entry : String(entry)).join("");
  }
  return typeof value === "string" ? value : String(value ?? "");
}
