import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Text, TouchableOpacity, StyleSheet, } from "react-native";
export const mobileDesignTokens = {
    color: {
        primary: "#0066CC",
        primaryText: "#FFFFFF",
        secondarySurface: "#F0F0F0",
        secondaryText: "#333333",
        danger: "#CC0000",
        surface: "#FFFFFF",
        border: "#E0E0E0",
        borderSubtle: "#F0F0F0",
        text: "#333333",
        textMuted: "#666666",
        textSubtle: "#999999",
        notificationSurface: "#FFF8E1",
        notificationTitle: "#6B4F00",
        notificationBody: "#7A6412",
        biometricSurface: "#EEF7F1",
        biometricTitle: "#0F5132",
        biometricBody: "#146C43",
        widgetSurface: "#F6F7FB",
        widgetTitle: "#475467",
        widgetValue: "#101828",
        widgetDetail: "#667085",
        shadow: "#000000",
    },
};
export function createMobileScreenDescriptor(manifest, tab) {
    return {
        featureId: manifest.id,
        tab,
        title: manifest.title,
    };
}
export function createMobileFeatureCard(title, subtitle, badge) {
    return badge == null ? { title, subtitle } : { title, subtitle, badge };
}
export function Button({ variant = "primary", size = "medium", style, children, ...props }) {
    const buttonStyles = [styles.button, styles[`button_${variant}`], styles[`button_${size}`]];
    const textStyles = [styles.buttonText, styles[`buttonText_${variant}`], styles[`buttonText_${size}`]];
    const resolvedButtonStyle = Array.isArray(style)
        ? [...buttonStyles, ...style]
        : style == null
            ? buttonStyles
            : [...buttonStyles, style];
    return (_jsx(TouchableOpacity, { style: resolvedButtonStyle, ...props, children: _jsx(Text, { style: textStyles, children: children }) }));
}
export function Card({ title, subtitle, badge, onPress, style }) {
    const content = (_jsxs(View, { style: [styles.card, style], children: [_jsxs(View, { style: styles.cardHeader, children: [_jsx(Text, { style: styles.cardTitle, children: title }), badge != null && _jsx(View, { style: styles.badge, children: _jsx(Text, { style: styles.badgeText, children: badge }) })] }), subtitle != null && _jsx(Text, { style: styles.cardSubtitle, children: subtitle })] }));
    if (onPress != null) {
        return (_jsx(TouchableOpacity, { onPress: onPress, activeOpacity: 0.7, children: content }));
    }
    return content;
}
export function TabBar({ tabs, activeTab, onTabChange }) {
    return (_jsx(View, { style: styles.tabBar, children: tabs.map((tab) => (_jsxs(TouchableOpacity, { style: [styles.tab, activeTab === tab.key && styles.tabActive], onPress: () => onTabChange(tab.key), children: [_jsx(Text, { style: [styles.tabText, activeTab === tab.key && styles.tabTextActive], children: tab.title }), tab.badge != null && _jsx(View, { style: styles.tabBadge, children: _jsx(Text, { style: styles.tabBadgeText, children: tab.badge }) })] }, tab.key))) }));
}
export function ListItem({ title, subtitle, rightText, onPress, style }) {
    const content = (_jsxs(View, { style: [styles.listItem, style], children: [_jsxs(View, { style: styles.listItemLeft, children: [_jsx(Text, { style: styles.listItemTitle, children: title }), subtitle != null && _jsx(Text, { style: styles.listItemSubtitle, children: subtitle })] }), rightText != null && _jsx(Text, { style: styles.listItemRight, children: rightText })] }));
    if (onPress != null) {
        return (_jsx(TouchableOpacity, { onPress: onPress, activeOpacity: 0.7, children: content }));
    }
    return content;
}
export function Header({ title, subtitle, leftAction, rightAction }) {
    return (_jsxs(View, { style: styles.header, children: [_jsx(View, { style: styles.headerLeft, children: leftAction != null && (_jsx(TouchableOpacity, { onPress: leftAction.onPress, children: _jsx(Text, { style: styles.headerAction, children: leftAction.label }) })) }), _jsxs(View, { style: styles.headerCenter, children: [_jsx(Text, { style: styles.headerTitle, children: title }), subtitle != null && _jsx(Text, { style: styles.headerSubtitle, children: subtitle })] }), _jsx(View, { style: styles.headerRight, children: rightAction != null && (_jsx(TouchableOpacity, { onPress: rightAction.onPress, children: _jsx(Text, { style: styles.headerAction, children: rightAction.label }) })) })] }));
}
export function GestureTouchable(props) {
    return _jsx(TouchableOpacity, { activeOpacity: 0.7, ...props });
}
export function PushNotification({ title, body }) {
    return (_jsxs(View, { style: styles.notificationCard, children: [_jsx(Text, { style: styles.notificationTitle, children: title }), _jsx(Text, { style: styles.notificationBody, children: body })] }));
}
export function BiometricAuth({ enabled, label }) {
    return (_jsxs(View, { style: styles.biometricCard, children: [_jsx(Text, { style: styles.biometricTitle, children: label ?? "Biometric Authentication" }), _jsx(Text, { style: styles.biometricStatus, children: enabled ? "Enabled" : "Disabled" })] }));
}
export function MobileWidget({ title, value, detail }) {
    return (_jsxs(View, { style: styles.widgetCard, children: [_jsx(Text, { style: styles.widgetTitle, children: title }), _jsx(Text, { style: styles.widgetValue, children: value }), detail != null && _jsx(Text, { style: styles.widgetDetail, children: detail })] }));
}
const styles = StyleSheet.create({
    button: {
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    button_primary: {
        backgroundColor: mobileDesignTokens.color.primary,
    },
    button_secondary: {
        backgroundColor: mobileDesignTokens.color.secondarySurface,
    },
    button_danger: {
        backgroundColor: mobileDesignTokens.color.danger,
    },
    button_small: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    button_medium: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    button_large: {
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    buttonText: {
        fontWeight: "600",
    },
    buttonText_primary: {
        color: mobileDesignTokens.color.primaryText,
    },
    buttonText_secondary: {
        color: mobileDesignTokens.color.secondaryText,
    },
    buttonText_danger: {
        color: mobileDesignTokens.color.primaryText,
    },
    buttonText_small: {
        fontSize: 12,
    },
    buttonText_medium: {
        fontSize: 14,
    },
    buttonText_large: {
        fontSize: 16,
    },
    card: {
        backgroundColor: mobileDesignTokens.color.surface,
        borderRadius: 12,
        padding: 16,
        shadowColor: mobileDesignTokens.color.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: mobileDesignTokens.color.text,
    },
    cardSubtitle: {
        fontSize: 14,
        color: mobileDesignTokens.color.textMuted,
        marginTop: 4,
    },
    badge: {
        backgroundColor: mobileDesignTokens.color.primary,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        color: mobileDesignTokens.color.primaryText,
        fontSize: 12,
        fontWeight: "600",
    },
    tabBar: {
        flexDirection: "row",
        backgroundColor: mobileDesignTokens.color.surface,
        borderTopWidth: 1,
        borderTopColor: mobileDesignTokens.color.border,
        paddingBottom: 20,
        paddingTop: 8,
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 8,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: mobileDesignTokens.color.primary,
    },
    tabText: {
        fontSize: 14,
        color: mobileDesignTokens.color.textMuted,
    },
    tabTextActive: {
        color: mobileDesignTokens.color.primary,
        fontWeight: "600",
    },
    tabBadge: {
        position: "absolute",
        top: 2,
        right: "20%",
        backgroundColor: mobileDesignTokens.color.danger,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    tabBadgeText: {
        color: mobileDesignTokens.color.primaryText,
        fontSize: 10,
        fontWeight: "600",
    },
    listItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: mobileDesignTokens.color.surface,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: mobileDesignTokens.color.borderSubtle,
    },
    listItemLeft: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 16,
        color: mobileDesignTokens.color.text,
    },
    listItemSubtitle: {
        fontSize: 14,
        color: mobileDesignTokens.color.textMuted,
        marginTop: 2,
    },
    listItemRight: {
        fontSize: 14,
        color: mobileDesignTokens.color.textSubtle,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: mobileDesignTokens.color.surface,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: mobileDesignTokens.color.border,
    },
    headerLeft: {
        width: 60,
    },
    headerCenter: {
        flex: 1,
        alignItems: "center",
    },
    headerRight: {
        width: 60,
        alignItems: "flex-end",
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: mobileDesignTokens.color.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: mobileDesignTokens.color.textMuted,
        marginTop: 2,
    },
    headerAction: {
        fontSize: 16,
        color: mobileDesignTokens.color.primary,
    },
    notificationCard: {
        borderRadius: 12,
        padding: 12,
        backgroundColor: mobileDesignTokens.color.notificationSurface,
    },
    notificationTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: mobileDesignTokens.color.notificationTitle,
    },
    notificationBody: {
        marginTop: 4,
        fontSize: 13,
        color: mobileDesignTokens.color.notificationBody,
    },
    biometricCard: {
        borderRadius: 12,
        padding: 12,
        backgroundColor: mobileDesignTokens.color.biometricSurface,
    },
    biometricTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: mobileDesignTokens.color.biometricTitle,
    },
    biometricStatus: {
        marginTop: 4,
        fontSize: 13,
        color: mobileDesignTokens.color.biometricBody,
    },
    widgetCard: {
        borderRadius: 12,
        padding: 14,
        backgroundColor: mobileDesignTokens.color.widgetSurface,
    },
    widgetTitle: {
        fontSize: 13,
        color: mobileDesignTokens.color.widgetTitle,
    },
    widgetValue: {
        marginTop: 6,
        fontSize: 20,
        fontWeight: "700",
        color: mobileDesignTokens.color.widgetValue,
    },
    widgetDetail: {
        marginTop: 4,
        fontSize: 12,
        color: mobileDesignTokens.color.widgetDetail,
    },
});
