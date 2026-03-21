import { useEffect, useRef, useState } from "react";
import { Animated, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";

import { formatINR } from "../core/models/UserProfile";

type AnimatedCurrencyValueProps = {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  style?: StyleProp<TextStyle>;
  variant?: "count" | "slot";
};

export function AnimatedCurrencyValue({
  value,
  duration = 700,
  formatter = formatINR,
  style,
  variant = "count",
}: AnimatedCurrencyValueProps) {
  const [displayValue, setDisplayValue] = useState(Math.round(value));
  const [activeText, setActiveText] = useState(formatter(Math.round(value)));
  const [previousText, setPreviousText] = useState<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const previousValueRef = useRef(Math.round(value));
  const currentTranslateY = useRef(new Animated.Value(0)).current;
  const previousTranslateY = useRef(new Animated.Value(0)).current;
  const previousOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant !== "slot") {
      return;
    }

    const nextRounded = Math.round(value);
    const nextText = formatter(nextRounded);

    if (nextText === activeText) {
      return;
    }

    setPreviousText(activeText);
    setActiveText(nextText);

    currentTranslateY.setValue(18);
    previousTranslateY.setValue(0);
    previousOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(currentTranslateY, {
        duration: Math.max(240, duration * 0.55),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(previousTranslateY, {
        duration: Math.max(240, duration * 0.55),
        toValue: -18,
        useNativeDriver: true,
      }),
      Animated.timing(previousOpacity, {
        duration: Math.max(220, duration * 0.5),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPreviousText(null);
    });
  }, [activeText, currentTranslateY, duration, formatter, previousOpacity, previousTranslateY, value, variant]);

  useEffect(() => {
    if (variant === "slot") {
      return;
    }

    const from = previousValueRef.current;
    const to = Math.round(value);

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (duration <= 0 || from === to) {
      previousValueRef.current = to;
      setDisplayValue(to);
      return;
    }

    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const nextValue = Math.round(from + (to - from) * progress);

      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      previousValueRef.current = to;
      frameRef.current = null;
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [duration, value, variant]);

  if (variant === "slot") {
    return (
      <View style={styles.slotWrap}>
        {previousText ? (
          <Animated.Text
            style={[
              style,
              styles.slotLayer,
              {
                opacity: previousOpacity,
                transform: [{ translateY: previousTranslateY }],
              },
            ]}
          >
            {previousText}
          </Animated.Text>
        ) : null}
        <Animated.Text
          style={[
            style,
            {
              transform: [{ translateY: currentTranslateY }],
            },
          ]}
        >
          {activeText}
        </Animated.Text>
      </View>
    );
  }

  return <Text style={style}>{formatter(displayValue)}</Text>;
}

const styles = StyleSheet.create({
  slotWrap: {
    minHeight: 28,
    overflow: "hidden",
  },
  slotLayer: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
