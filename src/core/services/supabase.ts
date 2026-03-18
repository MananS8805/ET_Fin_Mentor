import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { AppConfig, StorageKeys } from "../config";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "et-finmentor",
};

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      ...SECURE_STORE_OPTIONS,
      requireAuthentication: false,
    }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS),
};

const supabaseUrl = AppConfig.supabaseUrl || "https://placeholder.supabase.co";
const supabaseAnonKey = AppConfig.supabaseAnonKey || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
    return;
  }

  supabase.auth.stopAutoRefresh();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    void SecureStore.setItemAsync(StorageKeys.jwt, session.access_token, SECURE_STORE_OPTIONS);
    return;
  }

  void SecureStore.deleteItemAsync(StorageKeys.jwt, SECURE_STORE_OPTIONS);
});

export async function getStoredJwt(): Promise<string | null> {
  return SecureStore.getItemAsync(StorageKeys.jwt, SECURE_STORE_OPTIONS);
}

