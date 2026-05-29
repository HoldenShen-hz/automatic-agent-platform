import type { ButtonHTMLAttributes, PropsWithChildren, ReactElement } from "react";
type NativeStyle = Record<string, unknown>;
export type ViewStyle = NativeStyle;
export type TextStyle = NativeStyle;
type StyleValue = NativeStyle | false | undefined;
type StyleInput = StyleValue | readonly StyleValue[];
export interface TouchableOpacityProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
    readonly style?: StyleInput;
    readonly onPress?: () => void;
    readonly activeOpacity?: number;
}
export declare function View({ children, style }: PropsWithChildren<{
    style?: StyleInput;
}>): ReactElement;
export declare function Text({ children, style }: PropsWithChildren<{
    style?: StyleInput;
}>): ReactElement;
export declare function TouchableOpacity({ children, style, onPress, activeOpacity: _activeOpacity, ...props }: PropsWithChildren<TouchableOpacityProps>): ReactElement;
export declare const StyleSheet: {
    create<T extends Record<string, NativeStyle>>(styles: T): T;
};
export {};
