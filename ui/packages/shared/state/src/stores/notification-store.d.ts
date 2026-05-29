export type NotificationKind = "info" | "success" | "warning" | "error";
export interface Notification {
    readonly id: string;
    readonly kind: NotificationKind;
    readonly title: string;
    readonly message?: string;
    readonly createdAt: string;
    readonly read: boolean;
}
export interface NotificationStoreState {
    readonly notifications: readonly Notification[];
    readonly notificationLookup: Readonly<Record<string, Notification>>;
    readonly unreadCount: number;
    addNotification(notification: Omit<Notification, "id" | "createdAt" | "read">): void;
    markRead(id: string): void;
    markAllRead(): void;
    dismissNotification(id: string): void;
    clearAll(): void;
}
export declare function createNotificationStore(): import("zustand").StoreApi<NotificationStoreState>;
