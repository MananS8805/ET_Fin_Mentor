import { useEffect, useMemo, useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

type TypewriterTextProps = {
  text: string;
  speedMs?: number;
  style?: StyleProp<TextStyle>;
};

export function TypewriterText({ text, speedMs = 14, style }: TypewriterTextProps) {
  const [visibleLength, setVisibleLength] = useState(0);

  const safeText = useMemo(() => text ?? "", [text]);

  useEffect(() => {
    setVisibleLength(0);

    if (!safeText) {
      return;
    }

    const timer = setInterval(() => {
      setVisibleLength((current) => {
        if (current >= safeText.length) {
          clearInterval(timer);
          return current;
        }

        return current + 1;
      });
    }, speedMs);

    return () => clearInterval(timer);
  }, [safeText, speedMs]);

  return <Text style={style}>{safeText.slice(0, visibleLength)}</Text>;
}
