import { Platform, TextStyle, ViewStyle } from "react-native";

export const Colors = {
  navy: "#0A0A0A", // Deep dark background for headers
  gold: "#D4AF37", // Premium gold
  teal: "#00B852", // ET Money Emerald Green!
  red: "#FF3B30",
  purple: "#8B5CF6",
  surface: "#121212", // Pure dark background
  card: "#1E1E1E", // Slightly lighter to pop
  border: "#333333", // Subtle separators
  textPrimary: "#FFFFFF", // Sharp white
  textSecondary: "#A3A3A3", // Recessed grey
  textMuted: "#666666",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  } satisfies ViewStyle,
  primaryButton: {
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.teal, // ET Money Emerald Green
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  secondaryButton: {
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  } satisfies ViewStyle,
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
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
