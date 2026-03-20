const ENV_KEYS = {
  supabaseUrl: "EXPO_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  geminiApiKey: "EXPO_PUBLIC_GEMINI_API_KEY",
} as const;

type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

function readEnv(key: EnvKey): string {
  const value = process.env[key];

  if (!value) {
    console.warn(`[AppConfig] Missing environment variable: ${key}`);
    return "";
  }

  return value;
}

export const StorageKeys = {
  jwt: "et_finmentor_jwt",
  biometricEnabled: "et_finmentor_biometric_enabled",
  demoMode: "et_finmentor_demo_mode",
  demoPersona: "et_finmentor_demo_persona",
  profile: "et_finmentor_profile",
  dismissedAlerts: "et_finmentor_dismissed_alerts",
  alertNotificationSignature: "et_finmentor_alert_notification_signature",
  sipLogs: "et_finmentor_sip_logs",
healthScoreHistory: "et_finmentor_health_score_history",
} as const;

export const AppConfig = {
  supabaseUrl: readEnv(ENV_KEYS.supabaseUrl),
  supabaseAnonKey: readEnv(ENV_KEYS.supabaseAnonKey),
  geminiApiKey: readEnv(ENV_KEYS.geminiApiKey),
  appName: "ET FinMentor",
  otpResendSeconds: 60,
  otpMaxAttempts: 3,
  otpLockoutMs: 60 * 60 * 1000,
  demoTapThreshold: 5,
  demoTapWindowMs: 1500,
  isSupabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey);
  },
  isGeminiConfigured() {
    return Boolean(this.geminiApiKey);
  },
  isFullyConfigured() {
    return this.isSupabaseConfigured() && this.isGeminiConfigured();
  },
} as const;
