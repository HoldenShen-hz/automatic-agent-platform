export interface TranslationCatalog {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
  readonly fallbackLocales?: readonly string[];
}

export class TranslationService {
  private readonly catalogs = new Map<string, TranslationCatalog>();
  private currentLocale = "en-US";

  public register(catalog: TranslationCatalog): void {
    this.catalogs.set(catalog.locale, catalog);
  }

  public setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public translate(key: string, locale = this.currentLocale, fallbackLocale = "en-US"): string {
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
        return message;
      }
    }
    return key;
  }

  public detectLocale(preferredLocales: readonly string[]): string {
    for (const locale of preferredLocales) {
      if (this.catalogs.has(locale)) {
        return locale;
      }
    }
    return this.currentLocale;
  }
}

export function createDefaultTranslationService(): TranslationService {
  const service = new TranslationService();
  service.register({
    locale: "zh-CN",
    fallbackLocales: ["en-US"],
    messages: {
      "ui.app.title": "Automatic Agent Platform UI",
      "ui.planned": "规划中能力",
      "ui.implemented": "已接线能力",
    },
  });
  service.register({
    locale: "en-US",
    messages: {
      "ui.app.title": "Automatic Agent Platform UI",
      "ui.planned": "Planned capability",
      "ui.implemented": "Implemented capability",
    },
  });
  service.setLocale("zh-CN");
  return service;
}
