export interface TranslationCatalog {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
}

export class TranslationService {
  private readonly catalogs = new Map<string, TranslationCatalog>();

  public register(catalog: TranslationCatalog): void {
    this.catalogs.set(catalog.locale, catalog);
  }

  public translate(key: string, locale: string, fallbackLocale = "en-US"): string {
    const catalog = this.catalogs.get(locale) ?? this.catalogs.get(fallbackLocale);
    return catalog?.messages[key] ?? key;
  }
}

export function createDefaultTranslationService(): TranslationService {
  const service = new TranslationService();
  service.register({
    locale: "zh-CN",
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
  return service;
}
