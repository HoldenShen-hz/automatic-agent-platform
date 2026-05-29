import { jsx as _jsx } from "react/jsx-runtime";
function mergeStyle(style) {
    if (style == null) {
        return undefined;
    }
    if (Array.isArray(style)) {
        return style.reduce((merged, item) => item == null || item === false ? merged : { ...merged, ...item }, {});
    }
    if (style === false) {
        return undefined;
    }
    return style;
}
export function View({ children, style }) {
    return _jsx("div", { style: mergeStyle(style), children: children });
}
export function Text({ children, style }) {
    return _jsx("span", { style: mergeStyle(style), children: children });
}
export function TouchableOpacity({ children, style, onPress, activeOpacity: _activeOpacity, ...props }) {
    return (_jsx("button", { ...props, onClick: onPress ?? props.onClick, style: {
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            ...mergeStyle(style),
        }, type: props.type ?? "button", children: children }));
}
export const StyleSheet = {
    create(styles) {
        return styles;
    },
};
