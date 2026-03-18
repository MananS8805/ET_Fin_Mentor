import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Tabs } from "expo-router";

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

export default function DashboardLayout() {
  const demoMode = useAppStore((state) => state.demoMode);

  return (
    <Tabs
      screenOptions={({ route }) => {
        const meta = TAB_META[route.name as TabRouteName];

        return {
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontFamily: Typography.fontFamily.display,
            fontSize: Typography.size.lg,
          },
          headerRight: () => (demoMode ? <DemoBadge /> : null),
          tabBarStyle: {
            backgroundColor: Colors.navy,
            borderTopWidth: 0,
            paddingTop: 8,
            height: 72,
          },
          tabBarActiveTintColor: Colors.gold,
          tabBarInactiveTintColor: "rgba(255,255,255,0.7)",
          tabBarLabelStyle: {
            fontFamily: Typography.fontFamily.bodyMedium,
            fontSize: Typography.size.xs,
            marginBottom: 8,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={meta.icon} size={size} color={color} />
          ),
          title: meta.title,
          tabBarLabel: meta.label,
        };
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="future-you" />
      <Tabs.Screen name="fire-planner" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
