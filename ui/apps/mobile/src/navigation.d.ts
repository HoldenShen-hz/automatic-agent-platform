export interface MobileScreenDefinition {
    readonly id: string;
    readonly title: string;
    readonly path: string;
    readonly requiresAuth: boolean;
}
export interface MobileTabNavigatorDefinition {
    readonly kind: "tab";
    readonly navigatorId: "root-tabs";
    readonly initialRouteId: string;
    readonly routes: readonly MobileScreenDefinition[];
}
export interface MobileStackNavigatorDefinition {
    readonly kind: "stack";
    readonly navigatorId: "settings-stack" | "modal-stack";
    readonly initialRouteId: string;
    readonly presentation: "card" | "modal";
    readonly routes: readonly MobileScreenDefinition[];
}
export declare const settingsSubRoutes: {
    id: string;
    title: string;
    path: string;
    requiresAuth: true;
}[];
export declare const rootTabNavigator: MobileTabNavigatorDefinition;
export declare const settingsStack: MobileStackNavigatorDefinition;
export declare const modalNavigator: MobileStackNavigatorDefinition;
export declare const mobileNavigation: {
    tabs: readonly MobileScreenDefinition[];
    rootTabNavigator: MobileTabNavigatorDefinition;
    settingsStack: MobileStackNavigatorDefinition;
    settingsSubRoutes: {
        id: string;
        title: string;
        path: string;
        requiresAuth: true;
    }[];
    modalNavigator: MobileStackNavigatorDefinition;
    modalFlows: readonly MobileScreenDefinition[];
};
export declare function resolveMobileScreen(screenId: string): MobileScreenDefinition | null;
