import { useEffect, useRef, useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { formatINR } from "../core/models/UserProfile";

type AnimatedCurrencyValueProps = {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  style?: StyleProp<TextStyle>;
};

export function AnimatedCurrencyValue({
  value,
  duration = 700,
  formatter = formatINR,
  style,
}: AnimatedCurrencyValueProps) {
  const [displayValue, setDisplayValue] = useState(Math.round(value));
  const frameRef = useRef<number | null>(null);
  const previousValueRef = useRef(Math.round(value));

  useEffect(() => {
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
  }, [duration, value]);

  return <Text style={style}>{formatter(displayValue)}</Text>;
}
