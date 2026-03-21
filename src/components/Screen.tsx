import { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, Spacing } from "../core/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  dark?: boolean;
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}>;

export function Screen({
  children,
  scroll = false,
  dark = false,
  footer,
  contentContainerStyle,
  style,
}: ScreenProps) {
  const backgroundColor = dark ? Colors.navy : Colors.surface;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }, style]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <LinearGradient
        colors={
          dark
            ? ["rgba(13, 34, 72, 0.35)", "rgba(9, 46, 38, 0.22)", "rgba(18, 18, 18, 0)"]
            : ["rgba(98, 177, 255, 0.16)", "rgba(109, 229, 187, 0.12)", "rgba(255, 255, 255, 0)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={[styles.glowOrb, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glowOrb, styles.glowBottom]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, contentContainerStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
  },
  glowOrb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(20, 184, 166, 0.12)",
  },
  glowTop: {
    width: 180,
    height: 180,
    top: -60,
    right: -30,
  },
  glowBottom: {
    width: 140,
    height: 140,
    bottom: 60,
    left: -40,
    backgroundColor: "rgba(212, 175, 55, 0.10)",
  },
});

