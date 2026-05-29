import { generateStableId } from "@aa/shared-api-client";
import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
function generateId() {
    return generateStableId("notif-");
}
export function createNotificationStore() {
    return createStore()(withPersistDevtoolsDraft("aa-notification-store", (set) => ({
        notifications: [],
        notificationLookup: {},
        unreadCount: 0,
        addNotification(notification) {
            const newNotification = {
                ...notification,
                id: generateId(),
                createdAt: new Date().toISOString(),
                read: false,
            };
            set((draft) => {
                draft.notifications = [newNotification, ...draft.notifications];
                draft.notificationLookup = {
                    ...draft.notificationLookup,
                    [newNotification.id]: newNotification,
                };
                draft.unreadCount += 1;
            });
        },
        markRead(id) {
            set((draft) => {
                const notification = draft.notificationLookup[id];
                if (notification == null || notification.read) {
                    return;
                }
                const nextNotification = {
                    ...notification,
                    read: true,
                };
                draft.notifications = draft.notifications.map((entry) => entry.id === id ? nextNotification : entry);
                draft.notificationLookup = {
                    ...draft.notificationLookup,
                    [id]: nextNotification,
                };
                draft.unreadCount = Math.max(0, draft.unreadCount - 1);
            });
        },
        markAllRead() {
            set((draft) => {
                draft.notifications = draft.notifications.map((notification) => ({
                    ...notification,
                    read: true,
                }));
                draft.notificationLookup = Object.fromEntries(draft.notifications.map((notification) => [notification.id, notification]));
                draft.unreadCount = 0;
            });
        },
        dismissNotification(id) {
            set((draft) => {
                const notification = draft.notificationLookup[id];
                draft.notifications = draft.notifications.filter((entry) => entry.id !== id);
                const nextLookup = { ...draft.notificationLookup };
                delete nextLookup[id];
                draft.notificationLookup = nextLookup;
                if (notification != null && !notification.read) {
                    draft.unreadCount = Math.max(0, draft.unreadCount - 1);
                }
            });
        },
        clearAll() {
            set((draft) => {
                draft.notifications = [];
                draft.notificationLookup = {};
                draft.unreadCount = 0;
            });
        },
    })));
}
