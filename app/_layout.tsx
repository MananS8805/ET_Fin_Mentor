import { useEffect } from "react";
import { View, Text, Button, LogBox } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";

import { Colors, Typography } from "../src/core/theme";
import { useAppStore } from "../src/core/services/store";

void SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  "Warning: WrappedComponent: Support for defaultProps will be removed",
  "Warning: VictoryAxis: Support for defaultProps will be removed",
  "Warning: VictoryBar: Support for defaultProps will be removed",
  "Warning: VictoryLine: Support for defaultProps will be removed",
  "Support for defaultProps will be removed from function components",
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.includes("Support for defaultProps will be removed from function components")) {
      return;
    }
    originalConsoleError(...args);
  };
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: Colors.bg }}>
      <Text style={{ fontSize: 20, marginBottom: 10, color: Colors.textPrimary, fontFamily: Typography.fontFamily.display }}>
        Something went wrong
      </Text>
      <Text style={{ color: Colors.textSecondary, marginBottom: 20, textAlign: "center" }}>
        {error instanceof Error ? error.message : "Unknown error"}
      </Text>
      <Button title="Try again" onPress={resetErrorBoundary} />
    </View>
  );
}

function NavigationGuard() {
  const router = useRouter();
  const currentProfile = useAppStore((state) => state.currentProfile);
  const demoMode = useAppStore((state) => state.demoMode);
  const authStatus = useAppStore((state) => state.authStatus);

  useEffect(() => {
    if (authStatus === "idle" || authStatus === "loading") return;
    if (demoMode) return;
    if (!currentProfile) return;
    if (!currentProfile.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [currentProfile, demoMode, authStatus, router]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NavigationGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.surface },
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontFamily: Typography.fontFamily.display,
          },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMMono_400Regular,
    DMMono_500Medium,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <RootLayoutNav />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
