import { ReactNode, useRef } from "react";
import { Animated, GestureResponderEvent, Pressable, StyleProp, ViewStyle } from "react-native";

type TiltCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxTiltDeg?: number;
  onPress?: () => void;
};

export function TiltCard({ children, style, maxTiltDeg = 5, onPress }: TiltCardProps) {
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (x: number, y: number, nextScale: number) => {
    Animated.parallel([
      Animated.spring(tiltX, { toValue: x, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.spring(tiltY, { toValue: y, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.spring(scale, { toValue: nextScale, useNativeDriver: true, speed: 20, bounciness: 5 }),
    ]).start();
  };

  const onPressIn = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const centerX = event.nativeEvent.pageX > 0 ? locationX : 0;
    const centerY = event.nativeEvent.pageY > 0 ? locationY : 0;
    const rotateY = centerX > 90 ? maxTiltDeg : -maxTiltDeg;
    const rotateX = centerY > 70 ? -maxTiltDeg : maxTiltDeg;
    animateTo(rotateX, rotateY, 1.01);
  };

  const onPressOut = () => {
    animateTo(0, 0, 1);
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          style,
          {
            transform: [
              { perspective: 850 },
              {
                rotateX: tiltX.interpolate({
                  inputRange: [-maxTiltDeg, maxTiltDeg],
                  outputRange: [`-${maxTiltDeg}deg`, `${maxTiltDeg}deg`],
                }),
              },
              {
                rotateY: tiltY.interpolate({
                  inputRange: [-maxTiltDeg, maxTiltDeg],
                  outputRange: [`-${maxTiltDeg}deg`, `${maxTiltDeg}deg`],
                }),
              },
              { scale },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
