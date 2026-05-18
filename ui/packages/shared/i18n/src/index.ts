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

type CatalogLoader = () => Promise<TranslationCatalog>;
type LocaleChangeListener = (locale: string, direction: TextDirection) => void;

export class TranslationService {
  private readonly catalogs = new Map<string, TranslationCatalog>();
  private readonly loaders = new Map<string, CatalogLoader>();
  private readonly directions = new Map<string, TextDirection>();
  private readonly nativeLabels = new Map<string, string>();
  private readonly listeners = new Set<LocaleChangeListener>();
  private currentLocale = "en-US";

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

  public setLocale(locale: string, documentRef?: Pick<Document, "documentElement">): void {
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

  public applyLocaleToDocument(documentRef?: Pick<Document, "documentElement">): void {
    const resolvedDocument = documentRef ?? (typeof document !== "undefined" ? document : undefined);
    if (resolvedDocument == null) {
      return;
    }
    resolvedDocument.documentElement.lang = this.currentLocale;
    resolvedDocument.documentElement.dir = this.getDirection(this.currentLocale);
  }

  public translate(
    key: string,
    locale = this.currentLocale,
    fallbackLocale = "en-US",
    values?: Readonly<Record<string, unknown>>,
  ): string {
    const chain = [locale];
    const catalog = this.catalogs.get(locale);
    if (catalog?.fallbackLocales != null) {
      chain.push(...catalog.fallbackLocales);
    }
    chain.push(fallbackLocale);
    for (const candidate of chain) {
      const resolved = this.catalogs.get(candidate);
      const message = resolved?.messages[key];
      if (message != null) {
        if (values == null || Object.keys(values).length === 0) {
          return message;
        }
        return new IntlMessageFormat(message, candidate).format(values) as string;
      }
    }
    return key;
  }

  public detectLocale(preferredLocales: readonly string[]): string {
    for (const locale of preferredLocales) {
      if (this.catalogs.has(locale)) {
        return locale;
      }
      if (this.loaders.has(locale)) {
        return locale;
      }
      const baseLanguage = locale.split("-")[0];
      const matchedLocale = this.listSupportedLocales().find((item) => item.locale.split("-")[0] === baseLanguage);
      if (matchedLocale != null) {
        return matchedLocale.locale;
      }
    }
    return this.currentLocale;
  }
}

export function createDefaultTranslationService(): TranslationService {
  const service = new TranslationService();
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
  service.setLocale("zh-CN");
  return service;
}

let sharedTranslationService: TranslationService | null = null;

export function getSharedTranslationService(): TranslationService {
  if (sharedTranslationService == null) {
    sharedTranslationService = createDefaultTranslationService();
  }
  return sharedTranslationService;
}

export function translateMessage(
  key: string,
  values?: Readonly<Record<string, unknown>>,
): string {
  const service = getSharedTranslationService();
  return service.translate(key, service.getLocale(), "en-US", values);
}

export function translateFeatureCopy(featureId: string): FeatureTranslationCopy {
  const defaultTitle = featureId
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const defaultSummary = `${defaultTitle || "Feature"} workspace`;
  const title = translateMessage(`ui.feature.${featureId}.title`);
  const summary = translateMessage(`ui.feature.${featureId}.summary`);
  return {
    title: title === `ui.feature.${featureId}.title` ? defaultTitle : title,
    summary: summary === `ui.feature.${featureId}.summary` ? defaultSummary : summary,
  };
}
