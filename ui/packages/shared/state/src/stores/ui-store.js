import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
export function createUiStore() {
    return createStore()(withPersistDevtoolsDraft("aa-ui-store", (set) => ({
        activeRoute: "/",
        activeFeature: "dashboard",
        sidebarCollapsed: false,
        commandPaletteOpen: false,
        nlPanelOpen: false,
        themeMode: "system",
        setActiveRoute(activeRoute) {
            set((draft) => {
                draft.activeRoute = activeRoute;
            });
        },
        setActiveFeature(activeFeature) {
            set((draft) => {
                draft.activeFeature = activeFeature;
            });
        },
        toggleSidebar() {
            set((draft) => {
                draft.sidebarCollapsed = !draft.sidebarCollapsed;
            });
        },
        setCommandPaletteOpen(commandPaletteOpen) {
            set((draft) => {
                draft.commandPaletteOpen = commandPaletteOpen;
            });
        },
        setNlPanelOpen(nlPanelOpen) {
            set((draft) => {
                draft.nlPanelOpen = nlPanelOpen;
            });
        },
        setThemeMode(themeMode) {
            set((draft) => {
                draft.themeMode = themeMode;
            });
        },
    })));
}
