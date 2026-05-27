import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type TouchableOpacityProps,
} from "react-native";

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
} as const;

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

export function createMobileScreenDescriptor(
  manifest: { id: string; title: string; [key: string]: unknown },
  tab: MobileScreenDescriptor["tab"],
): MobileScreenDescriptor {
  return {
    featureId: manifest.id,
    tab,
    title: manifest.title,
  };
}

export function createMobileFeatureCard(title: string, subtitle: string, badge?: string): MobileFeatureCard {
  return badge == null ? { title, subtitle } : { title, subtitle, badge };
}

interface ButtonProps extends TouchableOpacityProps {
  readonly variant?: "primary" | "secondary" | "danger";
  readonly size?: "small" | "medium" | "large";
  readonly children: React.ReactNode;
}

export function Button({ variant = "primary", size = "medium", style, children, ...props }: ButtonProps): React.JSX.Element {
  const buttonStyles: ViewStyle[] = [styles.button, styles[`button_${variant}`], styles[`button_${size}`]];
  const textStyles: TextStyle[] = [styles.buttonText, styles[`buttonText_${variant}`], styles[`buttonText_${size}`]];
  const resolvedButtonStyle = Array.isArray(style)
    ? [...buttonStyles, ...style]
    : style == null
      ? buttonStyles
      : [...buttonStyles, style];

  return (
    <TouchableOpacity style={resolvedButtonStyle} {...props}>
      <Text style={textStyles}>{children}</Text>
    </TouchableOpacity>
  );
}

interface CardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly badge?: string;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function Card({ title, subtitle, badge, onPress, style }: CardProps): React.JSX.Element {
  const content = (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge != null && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      </View>
      {subtitle != null && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (onPress != null) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface TabBarProps {
  readonly tabs: readonly { key: string; title: string; badge?: string }[];
  readonly activeTab: string;
  readonly onTabChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): React.JSX.Element {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.title}</Text>
          {tab.badge != null && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{tab.badge}</Text></View>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface ListItemProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly rightText?: string;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function ListItem({ title, subtitle, rightText, onPress, style }: ListItemProps): React.JSX.Element {
  const content = (
    <View style={[styles.listItem, style]}>
      <View style={styles.listItemLeft}>
        <Text style={styles.listItemTitle}>{title}</Text>
        {subtitle != null && <Text style={styles.listItemSubtitle}>{subtitle}</Text>}
      </View>
      {rightText != null && <Text style={styles.listItemRight}>{rightText}</Text>}
    </View>
  );

  if (onPress != null) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface HeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly leftAction?: { label: string; onPress: () => void };
  readonly rightAction?: { label: string; onPress: () => void };
}

export function Header({ title, subtitle, leftAction, rightAction }: HeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {leftAction != null && (
          <TouchableOpacity onPress={leftAction.onPress}>
            <Text style={styles.headerAction}>{leftAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle != null && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.headerRight}>
        {rightAction != null && (
          <TouchableOpacity onPress={rightAction.onPress}>
            <Text style={styles.headerAction}>{rightAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function GestureTouchable(props: TouchableOpacityProps): React.JSX.Element {
  return <TouchableOpacity activeOpacity={0.7} {...props} />;
}

export function PushNotification({ title, body }: { readonly title: string; readonly body: string }): React.JSX.Element {
  return (
    <View style={styles.notificationCard}>
      <Text style={styles.notificationTitle}>{title}</Text>
      <Text style={styles.notificationBody}>{body}</Text>
    </View>
  );
}

export function BiometricAuth({ enabled, label }: { readonly enabled: boolean; readonly label?: string }): React.JSX.Element {
  return (
    <View style={styles.biometricCard}>
      <Text style={styles.biometricTitle}>{label ?? "Biometric Authentication"}</Text>
      <Text style={styles.biometricStatus}>{enabled ? "Enabled" : "Disabled"}</Text>
    </View>
  );
}

export function MobileWidget({ title, value, detail }: { readonly title: string; readonly value: string; readonly detail?: string }): React.JSX.Element {
  return (
    <View style={styles.widgetCard}>
      <Text style={styles.widgetTitle}>{title}</Text>
      <Text style={styles.widgetValue}>{value}</Text>
      {detail != null && <Text style={styles.widgetDetail}>{detail}</Text>}
    </View>
  );
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
