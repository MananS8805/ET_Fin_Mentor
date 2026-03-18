import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Session } from "@supabase/supabase-js";

import { AppConfig, StorageKeys } from "../config";
import { DemoPersonaKey, getDemoProfile } from "../models/UserProfile";
import { ProfileService } from "./ProfileService";
import { supabase } from "./supabase";

type LockoutState = {
  attempts: number;
  lockedUntil: number | null;
};

export class AuthLockoutError extends Error {
  remainingMs: number;

  constructor(remainingMs: number) {
    super(`Too many attempts. Try again in ${Math.ceil(remainingMs / 1000 / 60)} minutes.`);
    this.remainingMs = remainingMs;
  }
}

export type AuthSessionState =
  | { mode: "demo"; persona: DemoPersonaKey }
  | { mode: "auth"; session: Session }
  | null;

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "et-finmentor",
};

const attemptTracker = new Map<string, LockoutState>();

function buildAttemptKey(kind: "phone" | "email", identifier: string): string {
  return `${kind}:${identifier.trim().toLowerCase()}`;
}

function ensureNotLocked(key: string): void {
  const state = attemptTracker.get(key);

  if (!state?.lockedUntil) {
    return;
  }

  if (state.lockedUntil <= Date.now()) {
    attemptTracker.delete(key);
    return;
  }

  throw new AuthLockoutError(state.lockedUntil - Date.now());
}

function trackFailure(key: string): void {
  const current = attemptTracker.get(key) ?? { attempts: 0, lockedUntil: null };
  const attempts = current.attempts + 1;
  const lockedUntil = attempts >= AppConfig.otpMaxAttempts ? Date.now() + AppConfig.otpLockoutMs : null;

  attemptTracker.set(key, { attempts, lockedUntil });
}

function clearFailures(key: string): void {
  attemptTracker.delete(key);
}

function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.length !== 10) {
    throw new Error("Please enter a valid 10-digit Indian mobile number.");
  }

  return `+91${digits}`;
}

function normalizeEmail(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  return email;
}

function presentSupabaseAuthError(message: string): Error {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("unsupported phone provider")) {
    return new Error(
      "Phone OTP is not configured in Supabase yet. In your Supabase project, enable Phone auth and connect an SMS provider like Twilio before using Send OTP."
    );
  }

  return new Error(message);
}

async function persistSession(session: Session | null): Promise<void> {
  if (!session?.access_token) {
    await SecureStore.deleteItemAsync(StorageKeys.jwt, SECURE_STORE_OPTIONS);
    return;
  }

  await SecureStore.setItemAsync(StorageKeys.jwt, session.access_token, SECURE_STORE_OPTIONS);
}

async function getFreshSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) {
    return null;
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;

  if (expiresAt > Date.now() + 30_000) {
    await persistSession(session);
    return session;
  }

  const refresh = await supabase.auth.refreshSession();
  const refreshedSession = refresh.data.session ?? null;
  await persistSession(refreshedSession);
  return refreshedSession;
}

export const AuthService = {
  async sendPhoneOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    ensureNotLocked(buildAttemptKey("phone", phone));

    const response = await supabase.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
      },
    });

    if (response.error) {
      throw presentSupabaseAuthError(response.error.message);
    }

    return { phone };
  },

  async verifyPhoneOtp(rawPhone: string, token: string) {
    const phone = normalizePhone(rawPhone);
    const attemptKey = buildAttemptKey("phone", phone);
    ensureNotLocked(attemptKey);

    const response = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (response.error) {
      trackFailure(attemptKey);
      throw presentSupabaseAuthError(response.error.message);
    }

    clearFailures(attemptKey);
    await persistSession(response.data.session ?? null);
    return response.data.session ?? null;
  },

  async sendEmailOtp(rawEmail: string) {
    const email = normalizeEmail(rawEmail);
    ensureNotLocked(buildAttemptKey("email", email));

    const response = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (response.error) {
      throw presentSupabaseAuthError(response.error.message);
    }

    return { email };
  },

  async verifyEmailOtp(rawEmail: string, token: string) {
    const email = normalizeEmail(rawEmail);
    const attemptKey = buildAttemptKey("email", email);
    ensureNotLocked(attemptKey);

    const response = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (response.error) {
      trackFailure(attemptKey);
      throw presentSupabaseAuthError(response.error.message);
    }

    clearFailures(attemptKey);
    await persistSession(response.data.session ?? null);
    return response.data.session ?? null;
  },

  async canUseBiometric() {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    return hasHardware && isEnrolled;
  },

  async promptBiometric(promptMessage = "Unlock ET FinMentor") {
    const available = await this.canUseBiometric();

    if (!available) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use device passcode",
      cancelLabel: "Skip",
      disableDeviceFallback: false,
    });

    return result.success;
  },

  async setBiometricEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(
      StorageKeys.biometricEnabled,
      enabled ? "true" : "false",
      SECURE_STORE_OPTIONS
    );
  },

  async isBiometricEnabled() {
    const flag = await SecureStore.getItemAsync(StorageKeys.biometricEnabled, SECURE_STORE_OPTIONS);
    return flag === "true";
  },

  async activateDemoMode(persona: DemoPersonaKey = "rohan") {
    await supabase.auth.signOut();
    await persistSession(null);
    await SecureStore.setItemAsync(StorageKeys.demoMode, "true", SECURE_STORE_OPTIONS);
    await SecureStore.setItemAsync(StorageKeys.demoPersona, persona, SECURE_STORE_OPTIONS);
    return getDemoProfile(persona);
  },

  async isDemoMode() {
    const demoMode = await SecureStore.getItemAsync(StorageKeys.demoMode, SECURE_STORE_OPTIONS);
    return demoMode === "true";
  },

  async getDemoPersona() {
    const persona = await SecureStore.getItemAsync(StorageKeys.demoPersona, SECURE_STORE_OPTIONS);

    if (persona === "rohan" || persona === "priya" || persona === "vikram") {
      return persona;
    }

    return "rohan" as DemoPersonaKey;
  },

  async setDemoPersona(persona: DemoPersonaKey) {
    await SecureStore.setItemAsync(StorageKeys.demoPersona, persona, SECURE_STORE_OPTIONS);
    return getDemoProfile(persona);
  },

  async restoreSession(): Promise<AuthSessionState> {
    if (await this.isDemoMode()) {
      return {
        mode: "demo",
        persona: await this.getDemoPersona(),
      };
    }

    const session = await getFreshSession();

    if (!session) {
      return null;
    }

    return {
      mode: "auth",
      session,
    };
  },

  async ensureValidSession(): Promise<AuthSessionState> {
    return this.restoreSession();
  },

  async signOut() {
    await supabase.auth.signOut();
    await persistSession(null);
    await ProfileService.clearLocalProfile();
    await SecureStore.deleteItemAsync(StorageKeys.demoMode, SECURE_STORE_OPTIONS);
    await SecureStore.deleteItemAsync(StorageKeys.demoPersona, SECURE_STORE_OPTIONS);
    await SecureStore.deleteItemAsync(StorageKeys.dismissedAlerts, SECURE_STORE_OPTIONS);
    await SecureStore.deleteItemAsync(StorageKeys.alertNotificationSignature, SECURE_STORE_OPTIONS);
    await SecureStore.deleteItemAsync(StorageKeys.sipLogs, SECURE_STORE_OPTIONS);
  },
};
