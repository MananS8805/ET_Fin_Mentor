import { Platform, TextStyle, ViewStyle } from "react-native";

export const Colors = {
  bg:        "#0B0B0D",
  s1:        "#111114",
  s2:        "#17171B",
  s3:        "#1E1E23",
  b0:        "rgba(255,255,255,0.05)",
  b1:        "rgba(255,255,255,0.09)",
  b2:        "rgba(255,255,255,0.16)",
  t0:        "#F2F0EA",
  t1:        "#9A9A94",
  t2:        "#55555B",
  t3:        "#303035",
  gold:      "#C8A84B",
  goldDim:   "rgba(200,168,75,0.10)",
  goldDim2:  "rgba(200,168,75,0.18)",
  teal:      "#1FBE72",
  tealDim:   "rgba(31,190,114,0.10)",
  red:       "#DC4E4E",
  redDim:    "rgba(220,78,78,0.10)",
  amber:     "#D98E38",
  amberDim:  "rgba(217,142,56,0.10)",
  purple:    "#8572E0",
  purpleDim: "rgba(133,114,224,0.10)",
  blue:      "#3F83D4",
  blueDim:   "rgba(63,131,212,0.10)",
  // legacy aliases — keep so existing screens compile without changes
  navy:          "#0B0B0D",
  surface:       "#111114",
  card:          "#17171B",
  border:        "rgba(255,255,255,0.09)",
  textPrimary:   "#F2F0EA",
  textSecondary: "#9A9A94",
  textMuted:     "#55555B",
  white:         "#F2F0EA",
  black:         "#000000",
  success:       "#1FBE72",
  successLight:  "rgba(31,190,114,0.10)",
  error:         "#DC4E4E",
  errorLight:    "rgba(220,78,78,0.10)",
  warning:       "#D98E38",
  warningLight:  "rgba(217,142,56,0.10)",
  info:          "#3F83D4",
  infoLight:     "rgba(63,131,212,0.10)",
  positive:      "#1FBE72",
  negative:      "#DC4E4E",
  neutral:       "#55555B",
} as const;

export const Typography = {
  fontFamily: {
    display:         "InstrumentSerif_400Regular_Italic",
    displaySemiBold: "DMSans_500Medium",
    body:            "DMSans_400Regular",
    bodyMedium:      "DMSans_500Medium",
    numeric:         "DMMono_500Medium",
  },
  size: {
    xs:    12,
    sm:    14,
    md:    16,
    lg:    18,
    xl:    24,
    "2xl": 32,
    "3xl": 40,
  },
} as const;

export const Spacing = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   14,
  xl:   18,
  full: 999,
} as const;

export const Shadows = {
  none: { elevation: 0, shadowColor: "transparent" },
  sm:   { elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.30, shadowRadius: 4 },
  md:   { elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 8 },
  lg:   { elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.50, shadowRadius: 14 },
  xl:   { elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 20 },
} as const;

export const Animations = {
  timing: { fast: 150, normal: 250, slow: 400, verySlow: 650 },
} as const;

export const ComponentStyles = {
  screen:        { flex: 1, backgroundColor: "#0B0B0D" } satisfies ViewStyle,
  card:          { backgroundColor: "#111114", borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.09)", padding: 16 } satisfies ViewStyle,
  elevatedCard:  { backgroundColor: "#111114", borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.09)", padding: 16, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 8 } satisfies ViewStyle,
  premiumCard:   { backgroundColor: "rgba(200,168,75,0.18)", borderRadius: 14, borderWidth: 0.5, borderColor: "#C8A84B", padding: 16 } satisfies ViewStyle,
  successCard:   { backgroundColor: "rgba(31,190,114,0.10)",  borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(31,190,114,0.25)",  padding: 16 } satisfies ViewStyle,
  errorCard:     { backgroundColor: "rgba(220,78,78,0.10)",   borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(220,78,78,0.25)",   padding: 16 } satisfies ViewStyle,
  warningCard:   { backgroundColor: "rgba(217,142,56,0.10)",  borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(217,142,56,0.25)",  padding: 16 } satisfies ViewStyle,
  infoCard:      { backgroundColor: "rgba(63,131,212,0.10)",  borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(63,131,212,0.25)",  padding: 16 } satisfies ViewStyle,
  primaryButton: { height: 52, borderRadius: 999, backgroundColor: "#C8A84B", alignItems: "center", justifyContent: "center" } satisfies ViewStyle,
  secondaryButton: { height: 52, borderRadius: 999, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" } satisfies ViewStyle,
  ghostButton:   { height: 52, borderRadius: 999, borderWidth: 0.5, borderColor: "rgba(200,168,75,0.10)", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" } satisfies ViewStyle,
  input:         { borderWidth: 0.5, borderColor: "rgba(255,255,255,0.09)", borderRadius: 12, backgroundColor: "#17171B", paddingHorizontal: 16, paddingVertical: 12, color: "#F2F0EA", minHeight: 52 } satisfies TextStyle,
  appBar:        { backgroundColor: "#0B0B0D" } satisfies ViewStyle,
  tabBar:        { backgroundColor: "#0B0B0D", borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.09)", elevation: 0 } satisfies ViewStyle,
} as const;

export const textStyles = {
  display:    { fontFamily: "InstrumentSerif_400Regular_Italic", fontSize: 32, color: "#F2F0EA", lineHeight: 38 } satisfies TextStyle,
  heading:    { fontFamily: "DMSans_500Medium", fontSize: 24, color: "#F2F0EA" } satisfies TextStyle,
  subheading: { fontFamily: "DMSans_500Medium", fontSize: 18, color: "#F2F0EA" } satisfies TextStyle,
  body:       { fontFamily: "DMSans_400Regular", fontSize: 16, color: "#F2F0EA", lineHeight: 24 } satisfies TextStyle,
  bodyMedium: { fontFamily: "DMSans_500Medium",  fontSize: 16, color: "#F2F0EA" } satisfies TextStyle,
  bodyMuted:  { fontFamily: "DMSans_400Regular", fontSize: 14, color: "#9A9A94", lineHeight: 22 } satisfies TextStyle,
  numeric:    { fontFamily: "DMMono_500Medium",  fontSize: 24, color: "#F2F0EA", letterSpacing: -0.5 } satisfies TextStyle,
  eyebrow:    { fontFamily: "DMSans_500Medium",  fontSize: 12, color: "#55555B", letterSpacing: 1.2, textTransform: "uppercase" } satisfies TextStyle,
  caption:    { fontFamily: "DMSans_400Regular", fontSize: 12, color: "#55555B", lineHeight: 18 } satisfies TextStyle,
} as const;

export const Theme = { Colors, Typography, Spacing, Radius, Shadows, Animations, ComponentStyles, textStyles } as const;
