import { Platform, TextStyle, ViewStyle } from "react-native";

export const Colors = {
  navy: "#0C2340",
  gold: "#F5A623",
  teal: "#1D9E75",
  red: "#E24B4A",
  purple: "#7F77DD",
  surface: "#F6F7F9",
  card: "#FFFFFF",
  border: "#E5E7EB",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const Typography = {
  fontFamily: {
    // Safe fallback fonts until the real Syne and DM Sans files are added to assets/fonts.
    display: Platform.select({
      ios: "AvenirNext-Bold",
      android: "sans-serif-condensed",
      default: "System",
    }) as string,
    displaySemiBold: Platform.select({
      ios: "AvenirNext-DemiBold",
      android: "sans-serif-medium",
      default: "System",
    }) as string,
    body: Platform.select({
      ios: "AvenirNext-Regular",
      android: "sans-serif",
      default: "System",
    }) as string,
    bodyMedium: Platform.select({
      ios: "AvenirNext-Medium",
      android: "sans-serif-medium",
      default: "System",
    }) as string,
    numeric: Platform.select({
      ios: "AvenirNext-Bold",
      android: "sans-serif-medium",
      default: "System",
    }) as string,
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    "2xl": 32,
    "3xl": 40,
  },
} as const;

export const ComponentStyles = {
  screen: {
    flex: 1,
    backgroundColor: Colors.surface,
  } satisfies ViewStyle,
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
  } satisfies ViewStyle,
  elevatedCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    elevation: 2,
  } satisfies ViewStyle,
  primaryButton: {
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  secondaryButton: {
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    minHeight: 52,
  } satisfies TextStyle,
  appBar: {
    backgroundColor: Colors.navy,
  } satisfies ViewStyle,
  tabBar: {
    backgroundColor: Colors.navy,
    borderTopWidth: 0,
    elevation: 2,
  } satisfies ViewStyle,
} as const;

export const textStyles = {
  display: {
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
    color: Colors.textPrimary,
  } satisfies TextStyle,
  heading: {
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  subheading: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  body: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  caption: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  } satisfies TextStyle,
  numeric: {
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.xl,
    color: Colors.textPrimary,
  } satisfies TextStyle,
} as const;

export const Theme = {
  Colors,
  Radius,
  Spacing,
  Typography,
  ComponentStyles,
  textStyles,
} as const;
