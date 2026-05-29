export interface SettingsVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly leftItems: readonly {
        title: string;
        description: string;
    }[];
    readonly centerRows: readonly {
        key: string;
        value: string;
    }[];
    readonly rightItems: readonly {
        title: string;
        description: string;
    }[];
    readonly loading: boolean;
    readonly draftTheme: "light" | "dark" | "high-contrast";
    readonly draftLocale: string;
    readonly saveState: "idle" | "saving" | "saved" | "error";
    readonly activityItems: readonly {
        title: string;
        description: string;
    }[];
    readonly pendingOperations: number;
    readonly localeOptions: readonly {
        value: string;
        label: string;
    }[];
    readonly sectionItems: readonly {
        id: string;
        title: string;
        description: string;
    }[];
    setDraftTheme(theme: "light" | "dark" | "high-contrast"): void;
    setDraftLocale(locale: string): void;
    save(): Promise<void>;
}
export declare function useSettingsVm(): SettingsVm;
