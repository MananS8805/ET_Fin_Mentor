import { Platform, TextStyle, ViewStyle } from "react-native";

export const Colors = {
  // Core brand colors
  navy: "#0A0A0A", // Deep dark background for headers
  gold: "#D4AF37", // Premium gold
  teal: "#00B852", // ET Money Emerald Green!
  red: "#FF3B30",
  purple: "#8B5CF6",
  surface: "#121212", // Pure dark background
  card: "#1E1E1E", // Slightly lighter to pop
  border: "#333333", // Subtle separators
  
  // Text colors
  textPrimary: "#FFFFFF", // Sharp white
  textSecondary: "#A3A3A3", // Recessed grey
  textMuted: "#666666",
  white: "#FFFFFF",
  black: "#000000",
  
  // Financial sentiment colors
  success: "#10B981", // Emerald green - gains
  successLight: "#D1FAE5", // Light success background
  error: "#EF4444", // Red - losses
  errorLight: "#FEE2E2", // Light error background
  warning: "#F59E0B", // Amber - caution
  warningLight: "#FEF3C7", // Light warning background
  info: "#3B82F6", // Blue - information
  infoLight: "#DBEAFE", // Light info background
  positive: "#10B981",
  negative: "#EF4444",
  neutral: "#6B7280",
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

// Shadow definitions for visual depth
export const Shadows = {
  none: {
    elevation: 0,
    shadowColor: "rgba(0, 0, 0, 0)",
  },
  sm: {
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  md: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  lg: {
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  xl: {
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
} as const;

// Animation constants for consistency
export const Animations = {
  timing: {
    fast: 200,      // Quick interactions (press, tap)
    normal: 300,    // Standard transitions
    slow: 500,      // Longer animations (enters, exits)
    verySlow: 800,  // Page transitions
  },
  easing: {
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    linear: "linear",
  },
} as const;

export const Typography = {
  fontFamily: {
    display: Platform.select({
      ios: "Inter",
      android: "sans-serif-medium",
      default: "Geist",
    }) as string,
    displaySemiBold: Platform.select({
      ios: "Inter",
      android: "sans-serif-medium",
      default: "Geist",
    }) as string,
    body: Platform.select({
      ios: "Inter",
      android: "sans-serif",
      default: "Geist",
    }) as string,
    bodyMedium: Platform.select({
      ios: "Inter",
      android: "sans-serif-medium",
      default: "Geist",
    }) as string,
    numeric: Platform.select({
      ios: "Inter",
      android: "sans-serif-medium",
      default: "Geist",
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
  
  // Card styles - flat to elevated variations
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

  // Premium card with stronger elevation
  premiumCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.gold,
    padding: Spacing.lg,
    elevation: 3,
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  } satisfies ViewStyle,

  // Financial sentiment cards
  successCard: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.success,
    padding: Spacing.lg,
  } satisfies ViewStyle,

  errorCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.error,
    padding: Spacing.lg,
  } satisfies ViewStyle,

  warningCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.warning,
    padding: Spacing.lg,
  } satisfies ViewStyle,

  infoCard: {
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.info,
    padding: Spacing.lg,
  } satisfies ViewStyle,
  
  // Button styles
  primaryButton: {
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.teal,
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
  
  // Input field
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
  Shadows,
  Animations,
  Typography,
  ComponentStyles,
  textStyles,
} as const;
