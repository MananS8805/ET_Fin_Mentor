import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { DemoBadge } from "../../src/components/DemoBadge";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Typography } from "../../src/core/theme";

const TAB_META = {
  index: { icon: "home", title: "Home", label: "Home" },
  chat: { icon: "chatbubble-ellipses", title: "Money Chat", label: "Chat" },
  "future-you": { icon: "sparkles", title: "Future You", label: "Future" },
  "fire-planner": { icon: "flame", title: "FIRE Planner", label: "FIRE" },
  profile: { icon: "person-circle", title: "Profile", label: "Profile" },
} satisfies Record<string, { icon: ComponentProps<typeof Ionicons>["name"]; title: string; label: string }>;

type TabRouteName = keyof typeof TAB_META;

type ItemLayout = {
  h: number;
  w: number;
  x: number;
  y: number;
};

function LivingTabBar({ state, descriptors, navigation, insets, isWideLayout }: BottomTabBarProps & { isWideLayout: boolean }) {
  const [layouts, setLayouts] = useState<Record<string, ItemLayout>>({});
  const blobX = useSharedValue(0);
  const blobY = useSharedValue(0);

  const activeRouteKey = state.routes[state.index]?.key;
  const activeLayout = activeRouteKey ? layouts[activeRouteKey] : undefined;

  useEffect(() => {
    if (!activeLayout) return;
    blobX.value = withSpring(activeLayout.x, { damping: 16, stiffness: 180, mass: 0.55 });
    blobY.value = withSpring(activeLayout.y, { damping: 16, stiffness: 180, mass: 0.55 });
  }, [activeLayout, blobX, blobY]);

  const blobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: blobX.value }, { translateY: blobY.value }],
  }));

  const containerStyle = useMemo(
    () => [
      styles.tabShell,
      isWideLayout
        ? {
            bottom: 20,
            left: 14,
            paddingHorizontal: 8,
            paddingVertical: 10,
            top: 82,
            width: 80,
          }
        : {
            bottom: 10 + insets.bottom,
            left: 16,
            paddingHorizontal: 10,
            paddingVertical: 10,
            right: 16,
          },
    ],
    [insets.bottom, isWideLayout]
  );

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={containerStyle}>
        <LinearGradient
          colors={["rgba(12,18,30,0.96)", "rgba(20,31,46,0.94)", "rgba(16,24,36,0.95)"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />

        {activeLayout ? (
          <Animated.View
            style={[
              styles.blob,
              {
                height: activeLayout.h,
                width: activeLayout.w,
              },
              blobStyle,
            ]}
          />
        ) : null}

        <View style={[styles.tabItems, isWideLayout ? styles.tabItemsVertical : styles.tabItemsHorizontal]}>
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name as TabRouteName];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                canPreventDefault: true,
                target: route.key,
                type: "tabPress",
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                target: route.key,
                type: "tabLongPress",
              });
            };

            return (
              <Pressable
                accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                key={route.key}
                onLayout={(event) => {
                  const { height, width, x, y } = event.nativeEvent.layout;
                  setLayouts((prev) => {
                    const previous = prev[route.key];
                    if (
                      previous &&
                      previous.x === x &&
                      previous.y === y &&
                      previous.w === width &&
                      previous.h === height
                    ) {
                      return prev;
                    }
                    return { ...prev, [route.key]: { h: height, w: width, x, y } };
                  });
                }}
                onLongPress={onLongPress}
                onPress={onPress}
                style={styles.tabItem}
              >
                <Ionicons color={isFocused ? Colors.gold : "rgba(255,255,255,0.74)"} name={meta.icon} size={22} />
                {!isWideLayout ? <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : null]}>{meta.label}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function DashboardLayout() {
  const demoMode = useAppStore((state) => state.demoMode);
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 960;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => {
        const meta = TAB_META[route.name as TabRouteName];

        return {
          headerRight: () => (demoMode ? <DemoBadge /> : null),
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontFamily: Typography.fontFamily.display,
            fontSize: Typography.size.lg,
          },
          sceneStyle: isWideLayout
            ? {
                paddingLeft: 96,
              }
            : undefined,
          tabBarShowLabel: false,
          title: meta.title,
        };
      }}
      tabBar={(props) => <LivingTabBar {...props} insets={insets} isWideLayout={isWideLayout} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="future-you" />
      <Tabs.Screen name="fire-planner" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 24,
    borderWidth: 0.8,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  tabItems: {
    position: "relative",
    zIndex: 2,
  },
  tabItemsHorizontal: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tabItemsVertical: {
    alignItems: "center",
    gap: 8,
  },
  blob: {
    backgroundColor: "rgba(212,175,55,0.16)",
    borderColor: "rgba(212,175,55,0.48)",
    borderRadius: 16,
    borderWidth: 0.8,
    position: "absolute",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    zIndex: 1,
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 16,
    gap: 4,
    justifyContent: "center",
    minHeight: 54,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabLabel: {
    color: "rgba(255,255,255,0.66)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 10,
  },
  tabLabelActive: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});
