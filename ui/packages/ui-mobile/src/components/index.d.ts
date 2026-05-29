import React from "react";
import { type ViewStyle, type TouchableOpacityProps } from "react-native";
export declare const mobileDesignTokens: {
    readonly color: {
        readonly primary: "#0066CC";
        readonly primaryText: "#FFFFFF";
        readonly secondarySurface: "#F0F0F0";
        readonly secondaryText: "#333333";
        readonly danger: "#CC0000";
        readonly surface: "#FFFFFF";
        readonly border: "#E0E0E0";
        readonly borderSubtle: "#F0F0F0";
        readonly text: "#333333";
        readonly textMuted: "#666666";
        readonly textSubtle: "#999999";
        readonly notificationSurface: "#FFF8E1";
        readonly notificationTitle: "#6B4F00";
        readonly notificationBody: "#7A6412";
        readonly biometricSurface: "#EEF7F1";
        readonly biometricTitle: "#0F5132";
        readonly biometricBody: "#146C43";
        readonly widgetSurface: "#F6F7FB";
        readonly widgetTitle: "#475467";
        readonly widgetValue: "#101828";
        readonly widgetDetail: "#667085";
        readonly shadow: "#000000";
    };
};
export interface MobileScreenDescriptor {
    readonly featureId: string;
    readonly tab: "home" | "tasks" | "approvals" | "dashboard" | "more";
    readonly title: string;
}
export interface MobileFeatureCard {
    readonly title: string;
    readonly subtitle: string;
    readonly badge?: string;
}
export declare function createMobileScreenDescriptor(manifest: {
    id: string;
    title: string;
    [key: string]: unknown;
}, tab: MobileScreenDescriptor["tab"]): MobileScreenDescriptor;
export declare function createMobileFeatureCard(title: string, subtitle: string, badge?: string): MobileFeatureCard;
interface ButtonProps extends TouchableOpacityProps {
    readonly variant?: "primary" | "secondary" | "danger";
    readonly size?: "small" | "medium" | "large";
    readonly children: React.ReactNode;
}
export declare function Button({ variant, size, style, children, ...props }: ButtonProps): React.JSX.Element;
interface CardProps {
    readonly title: string;
    readonly subtitle?: string;
    readonly badge?: string;
    readonly onPress?: () => void;
    readonly style?: ViewStyle;
}
export declare function Card({ title, subtitle, badge, onPress, style }: CardProps): React.JSX.Element;
interface TabBarProps {
    readonly tabs: readonly {
        key: string;
        title: string;
        badge?: string;
    }[];
    readonly activeTab: string;
    readonly onTabChange: (key: string) => void;
}
export declare function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): React.JSX.Element;
interface ListItemProps {
    readonly title: string;
    readonly subtitle?: string;
    readonly rightText?: string;
    readonly onPress?: () => void;
    readonly style?: ViewStyle;
}
export declare function ListItem({ title, subtitle, rightText, onPress, style }: ListItemProps): React.JSX.Element;
interface HeaderProps {
    readonly title: string;
    readonly subtitle?: string;
    readonly leftAction?: {
        label: string;
        onPress: () => void;
    };
    readonly rightAction?: {
        label: string;
        onPress: () => void;
    };
}
export declare function Header({ title, subtitle, leftAction, rightAction }: HeaderProps): React.JSX.Element;
export declare function GestureTouchable(props: TouchableOpacityProps): React.JSX.Element;
export declare function PushNotification({ title, body }: {
    readonly title: string;
    readonly body: string;
}): React.JSX.Element;
export declare function BiometricAuth({ enabled, label }: {
    readonly enabled: boolean;
    readonly label?: string;
}): React.JSX.Element;
export declare function MobileWidget({ title, value, detail }: {
    readonly title: string;
    readonly value: string;
    readonly detail?: string;
}): React.JSX.Element;
export {};
