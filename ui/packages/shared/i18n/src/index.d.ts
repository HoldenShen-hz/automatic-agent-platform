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
export declare class TranslationService {
    private readonly catalogs;
    private readonly loaders;
    private readonly directions;
    private readonly nativeLabels;
    private readonly listeners;
    private readonly formatterCache;
    private readonly diagnosticsReporter;
    private appliedDocumentSnapshot;
    private currentLocale;
    constructor(options?: {
        readonly locale?: string;
        readonly diagnosticsReporter?: TranslationDiagnosticsReporter | null;
    });
    register(catalog: TranslationCatalog, registration?: LocaleRegistration): void;
    registerLoader(locale: string, loader: CatalogLoader, registration?: LocaleRegistration): void;
    loadLocale(locale: string): Promise<TranslationCatalog | null>;
    setLocale(locale: string, documentRef?: DocumentRef): void;
    getLocale(): string;
    getDirection(locale?: string): TextDirection;
    listSupportedLocales(): readonly SupportedLocale[];
    subscribe(listener: LocaleChangeListener): () => void;
    applyLocaleToDocument(documentRef?: DocumentRef): void;
    dispose(documentRef?: DocumentRef): void;
    translate(key: string, locale?: string, fallbackLocale?: string, values?: Readonly<Record<string, unknown>>): string;
    translateMany(keys: readonly string[], locale?: string, fallbackLocale?: string): Readonly<Record<string, string>>;
    detectLocale(preferredLocales: readonly string[]): string;
    private lookupMessage;
    private buildFallbackChain;
}
export declare function createDefaultTranslationService(): TranslationService;
export declare function getSharedTranslationService(): TranslationService;
export declare function resetSharedTranslationService(documentRef?: DocumentRef): void;
export declare function translateMessage(key: string, values?: Readonly<Record<string, unknown>>): string;
export declare function translateFeatureCopy(featureId: string): FeatureTranslationCopy;
export {};
