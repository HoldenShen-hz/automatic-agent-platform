import type { MobileScreenDescriptor } from "../components";
export declare const mobileNavigationBaseline: readonly [{
    readonly tab: "dashboard";
    readonly title: "Dashboard";
}, {
    readonly tab: "tasks";
    readonly title: "Tasks";
}, {
    readonly tab: "workflow-cockpit";
    readonly title: "Workflow Cockpit";
}, {
    readonly tab: "approvals";
    readonly title: "Approvals";
}, {
    readonly tab: "conversation";
    readonly title: "Conversation";
}, {
    readonly tab: "settings";
    readonly title: "Settings";
}];
export declare function buildMobileRouteMap(screens: readonly MobileScreenDescriptor[]): Record<string, readonly string[]>;
