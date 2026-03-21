import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Colors, Radius, Spacing, Typography } from "../core/theme";

type LiquidProgressBarProps = {
  progress: number;
  height?: number;
  showLabel?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function LiquidProgressBar({
  progress,
  height = 12,
  showLabel = true,
  label,
  style,
  labelStyle,
}: LiquidProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const normalized = useMemo(() => clampProgress(progress), [progress]);
  const fillWidth = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!trackWidth) return;
    fillWidth.value = withTiming(trackWidth * normalized, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillWidth, normalized, trackWidth]);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [pulse]);

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.12,
    transform: [{ scaleY: 0.94 + pulse.value * 0.06 }],
  }));

  const percentageLabel = `${Math.round(normalized * 100)}%`;

  return (
    <View style={style}>
      <View
        onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
        style={[styles.track, { height }]}
      >
        <Animated.View style={[styles.fillWrap, fillStyle]}>
          <LinearGradient
            colors={["#A855F7", "#FFD700"]}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View pointerEvents="none" style={[styles.pulseLayer, pulseStyle]} />
        </Animated.View>
      </View>
      {showLabel ? (
        <Text style={[styles.label, labelStyle]}>{label ? `${label} ${percentageLabel}` : percentageLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: Radius.full,
    borderWidth: 0.8,
    overflow: "hidden",
    width: "100%",
  },
  fillWrap: {
    borderRadius: Radius.full,
    height: "100%",
    minWidth: 8,
    overflow: "hidden",
  },
  pulseLayer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    height: "100%",
    width: "100%",
  },
  label: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    marginTop: Spacing.xs,
  },
});
