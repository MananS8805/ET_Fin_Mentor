import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { ComponentProps, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { DemoBadge } from "../../src/components/DemoBadge";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Typography } from "../../src/core/theme";

const TAB_META = {
  index:          { icon: "home",                 title: "Home",        label: "Home"    },
  chat:           { icon: "chatbubble-ellipses",  title: "Money Chat",  label: "Chat"    },
  "future-you":   { icon: "sparkles",             title: "Future You",  label: "Future"  },
  "fire-planner": { icon: "flame",                title: "FIRE Planner",label: "FIRE"    },
  profile:        { icon: "person-circle",        title: "Profile",     label: "Profile" },
} satisfies Record<string, { icon: ComponentProps<typeof Ionicons>["name"]; title: string; label: string }>;

type TabRouteName = keyof typeof TAB_META;

type ItemLayout = { h: number; w: number; x: number; y: number };

function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps & { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const [layouts, setLayouts] = useState<Record<string, ItemLayout>>({});
  const blobX = useSharedValue(0);
  const blobW = useSharedValue(54);

  const activeRouteKey = state.routes[state.index]?.key;
  const activeLayout   = activeRouteKey ? layouts[activeRouteKey] : undefined;

  useEffect(() => {
    if (!activeLayout) return;
    blobX.value = withSpring(activeLayout.x, { damping: 18, stiffness: 200, mass: 0.6 });
    blobW.value = withSpring(activeLayout.w, { damping: 18, stiffness: 200, mass: 0.6 });
  }, [activeLayout, blobX, blobW]);

  const blobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: blobX.value }],
    width: blobW.value,
  }));

  // hide tab bar on twin-detail screen
  const activeRouteName = state.routes[state.index]?.name;
  if (activeRouteName === "twin-detail") return null;

  return (
    <View pointerEvents="box-none" style={[styles.navShell, { bottom: 12 + insets.bottom }]}>
      <LinearGradient
        colors={["rgba(17,17,20,0.97)", "rgba(14,14,17,0.97)"]}
        style={StyleSheet.absoluteFillObject}
      />
      {activeLayout ? (
        <Animated.View style={[styles.blob, blobStyle]} />
      ) : null}
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const meta      = TAB_META[route.name as TabRouteName];
          if (!meta) return null; // hide twin-detail from tab bar
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ canPreventDefault: true, target: route.key, type: "tabPress" });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              key={route.key}
              onLayout={(e) => {
                const { height, width, x, y } = e.nativeEvent.layout;
                setLayouts((prev) => {
                  const p = prev[route.key];
                  if (p && p.x === x && p.y === y && p.w === width && p.h === height) return prev;
                  return { ...prev, [route.key]: { h: height, w: width, x, y } };
                });
              }}
              onLongPress={() => navigation.emit({ target: route.key, type: "tabLongPress" })}
              onPress={onPress}
              style={styles.tabItem}
            >
              <Ionicons name={meta.icon} size={20} color={isFocused ? Colors.gold : Colors.t2} />
              <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function DashboardLayout() {
  const router = useRouter();
  const demoMode = useAppStore((state) => state.demoMode);
  const authStatus = useAppStore((state) => state.authStatus);
  const session = useAppStore((state) => state.session);
  const currentProfile = useAppStore((state) => state.currentProfile);
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 960;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (authStatus === "idle" || authStatus === "loading") return;
    if (demoMode) return;
    if (authStatus === "unauthenticated" || !session) {
      router.replace("/auth");
      return;
    }
    if (!currentProfile) return;
  }, [authStatus, currentProfile, demoMode, router, session]);

  return (
    <Tabs
      screenOptions={({ route }) => {
        const meta = TAB_META[route.name as TabRouteName];
        return {
          headerRight: () => (demoMode ? <DemoBadge /> : null),
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: Colors.white,
          headerShown: false,
          headerTitleStyle: { fontFamily: Typography.fontFamily.display, fontSize: Typography.size.lg },
          sceneStyle: isWideLayout ? { paddingLeft: 96 } : undefined,
          tabBarShowLabel: false,
          title: meta?.title ?? "",
        };
      }}
      tabBar={(props) => <FloatingTabBar {...props} insets={insets} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="future-you" />
      <Tabs.Screen name="fire-planner" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="twin-detail" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  navShell: {
    position: "absolute", left: 16, right: 16,
    borderRadius: 26, borderWidth: 0.5, borderColor: Colors.b1, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 12,
  },
  blob: {
    position: "absolute", top: 6, height: 46, borderRadius: 20,
    backgroundColor: Colors.goldDim, borderWidth: 0.5,
    borderColor: "rgba(200,168,75,0.35)",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20, shadowRadius: 8, zIndex: 1,
  },
  tabRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 8, paddingVertical: 8, zIndex: 2,
  },
  tabItem: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 3, minHeight: 46, borderRadius: 18, paddingVertical: 6, zIndex: 2,
  },
  tabLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bodyMedium, letterSpacing: 0.5, textTransform: "uppercase" },
  tabLabelActive:   { color: Colors.gold },
  tabLabelInactive: { color: Colors.t3  },
});