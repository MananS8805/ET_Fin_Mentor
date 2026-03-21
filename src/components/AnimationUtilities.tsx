import { useRef, useEffect } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";
import { Animations } from "../core/theme";

export type AnimationType = "fadeIn" | "slideUp" | "slideDown" | "scaleIn" | "fadeInScale";

interface UseAnimateProps {
  type: AnimationType;
  delay?: number;
  duration?: number;
  useNativeDriver?: boolean;
  onComplete?: () => void;
}

/**
 * Reusable animation hook for entrance animations
 */
export function useAnimate({
  type,
  delay = 0,
  duration = Animations.timing.normal,
  useNativeDriver = true,
  onComplete,
}: UseAnimateProps) {
  const fadeAnim = useRef(new Animated.Value(type === "fadeIn" || type === "fadeInScale" ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(type.includes("slide") ? 20 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(type === "scaleIn" || type === "fadeInScale" ? 0.9 : 1)).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    if (type === "fadeIn" || type === "fadeInScale" || type.includes("slide")) {
      animations.push(
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver,
        })
      );
    }

    if (type === "slideUp") {
      animations.push(
        Animated.timing(slideAnim, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver,
        })
      );
    }

    if (type === "slideDown") {
      animations.push(
        Animated.timing(slideAnim, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver,
        })
      );
    }

    if (type === "scaleIn" || type === "fadeInScale") {
      animations.push(
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver,
        })
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start(
        ({ finished }) => {
          if (finished && onComplete) {
            onComplete();
          }
        }
      );
    }
  }, [type, delay, duration, useNativeDriver, fadeAnim, slideAnim, scaleAnim, onComplete]);

  return {
    fadeAnim,
    slideAnim,
    scaleAnim,
    animatedStyle: {
      opacity: fadeAnim,
      transform: [
        { translateY: slideAnim },
        { scale: scaleAnim },
      ],
    } as StyleProp<ViewStyle>,
  };
}

/**
 * Hook for press/interaction animations
 */
export function usePressAnimation() {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  return {
    scaleAnim,
    handlePressIn,
    handlePressOut,
    animatedStyle: {
      transform: [{ scale: scaleAnim }],
    } as StyleProp<ViewStyle>,
  };
}

/**
 * Utility for card entrance animation
 */
export function createCardAnimation(delay: number = 0) {
  const opacity = new Animated.Value(0);
  const translateY = new Animated.Value(20);

  Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration: Animations.timing.normal,
      delay,
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      duration: Animations.timing.normal,
      delay,
      useNativeDriver: true,
    }),
  ]).start();

  return {
    opacity,
    transform: [{ translateY }],
  };
}

/**
 * Utility for creating staggered list animations
 */
export function createStaggeredListAnimation(itemCount: number, baseDelay: number = 0, itemDelay: number = 50) {
  return Array.from({ length: itemCount }, (_, index) => ({
    opacity: new Animated.Value(0),
    transform: new Animated.Value(20),
    delay: baseDelay + index * itemDelay,
  }));
}
