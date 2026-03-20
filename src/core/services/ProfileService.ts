import * as SecureStore from "expo-secure-store";
import { Session } from "@supabase/supabase-js";

import { AppConfig, StorageKeys } from "../config";
import { UserProfileData, createEmptyUserProfile } from "../models/UserProfile";
import { supabase } from "./supabase";

type UserProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  monthly_income: number | null;
  annual_income: number | null;
  monthly_expenses: number | null;
  monthly_emi: number | null;
  existing_corpus: number | null;
  monthly_sip: number | null;
  emergency_fund: number | null;
  term_insurance_cover: number | null;
  health_insurance_cover: number | null;
  annual_pf: number | null;
  annual_80c: number | null;
  annual_nps: number | null;
  annual_hra: number | null;
  risk_profile: UserProfileData["riskProfile"] | null;
  retirement_age: number | null;
  target_monthly_expense_retirement: number | null;
  goals: string[] | null;
  total_debt: number | null;
  onboarding_complete: boolean | null;
  cams_data: any | null;
};

export interface SaveProfileResult {
  profile: UserProfileData;
  savedLocally: boolean;
  syncedToSupabase: boolean;
  syncError: string | null;
}

import { normalizePhone } from "../utils/phone";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "et-finmentor",
};

function toRow(profile: UserProfileData, userId: string) {
  return {
    user_id: userId,
    name: profile.name || null,
    age: profile.age || null,
    phone: profile.phone || null,
    email: profile.email || null,
    monthly_income: profile.monthlyIncome,
    annual_income: profile.annualIncome || profile.monthlyIncome * 12,
    monthly_expenses: profile.monthlyExpenses,
    monthly_emi: profile.monthlyEMI,
    existing_corpus: profile.existingCorpus,
    monthly_sip: profile.monthlySIP,
    emergency_fund: profile.emergencyFund,
    term_insurance_cover: profile.termInsuranceCover,
    health_insurance_cover: profile.healthInsuranceCover,
    annual_pf: profile.annualPF,
    annual_80c: profile.annual80C,
    annual_nps: profile.annualNPS,
    annual_hra: profile.annualHRA,
    risk_profile: profile.riskProfile,
    retirement_age: profile.retirementAge,
    target_monthly_expense_retirement: profile.targetMonthlyExpenseRetirement,
    goals: profile.goals,
    total_debt: profile.totalDebt,
    onboarding_complete: profile.onboardingComplete,
    cams_data: profile.camsData ?? null,
  };
}

function fromRow(row: Partial<UserProfileRow>): UserProfileData {
  return createEmptyUserProfile({
    id: row.id ?? `profile-${Date.now()}`,
    name: row.name ?? "",
    age: toNumber(row.age),
    phone: row.phone ?? "",
    email: row.email ?? "",
    monthlyIncome: toNumber(row.monthly_income),
    annualIncome: toNumber(row.annual_income),
    monthlyExpenses: toNumber(row.monthly_expenses),
    monthlyEMI: toNumber(row.monthly_emi),
    existingCorpus: toNumber(row.existing_corpus),
    monthlySIP: toNumber(row.monthly_sip),
    emergencyFund: toNumber(row.emergency_fund),
    termInsuranceCover: toNumber(row.term_insurance_cover),
    healthInsuranceCover: toNumber(row.health_insurance_cover),
    annualPF: toNumber(row.annual_pf),
    annual80C: toNumber(row.annual_80c),
    annualNPS: toNumber(row.annual_nps),
    annualHRA: toNumber(row.annual_hra),
    riskProfile: row.risk_profile ?? "moderate",
    retirementAge: toNumber(row.retirement_age) || 55,
    targetMonthlyExpenseRetirement: toNumber(row.target_monthly_expense_retirement),
    goals: row.goals ?? [],
    totalDebt: toNumber(row.total_debt),
    onboardingComplete: Boolean(row.onboarding_complete),
    camsData: row.cams_data ?? undefined,
  });
}

async function saveLocalProfile(profile: UserProfileData) {
  await SecureStore.setItemAsync(StorageKeys.profile, JSON.stringify(profile), SECURE_STORE_OPTIONS);
}

export const ProfileService = {
  async getLocalProfile() {
    const rawProfile = await SecureStore.getItemAsync(StorageKeys.profile, SECURE_STORE_OPTIONS);

    if (!rawProfile) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawProfile) as Partial<UserProfileData>;
      return createEmptyUserProfile(parsed);
    } catch (error) {
      console.warn("[ProfileService] Failed to parse local profile", error);
      return null;
    }
  },

  async clearLocalProfile() {
    await SecureStore.deleteItemAsync(StorageKeys.profile, SECURE_STORE_OPTIONS);
  },

  async loadProfile(session: Session | null) {
    const localProfile = await this.getLocalProfile();

    if (!session?.user?.id || !AppConfig.isSupabaseConfigured()) {
      return localProfile;
    }

    const response = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (response.error) {
      console.warn("[ProfileService] Supabase profile fetch failed", response.error.message);
      return localProfile;
    }

    if (!response.data) {
      return localProfile;
    }

    const remoteProfile = fromRow(response.data as Partial<UserProfileRow>);
    await saveLocalProfile(remoteProfile);
    return remoteProfile;
  },

  async saveProfile(profile: UserProfileData, session: Session | null): Promise<SaveProfileResult> {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingSaveRequests.add(requestId);

    try {
      const sanitizedProfile = createEmptyUserProfile({
        ...profile,
        phone: normalizePhone(profile.phone),
        annualIncome: profile.annualIncome || profile.monthlyIncome * 12,
        onboardingComplete: true,
      });

      await saveLocalProfile(sanitizedProfile);

      if (!pendingSaveRequests.has(requestId)) {
        return {
          profile: sanitizedProfile,
          savedLocally: true,
          syncedToSupabase: false,
          syncError: "Save request was superseded by a newer request.",
        };
      }

      if (!session?.user?.id || !AppConfig.isSupabaseConfigured()) {
        return {
          profile: sanitizedProfile,
          savedLocally: true,
          syncedToSupabase: false,
          syncError: "No authenticated session or Supabase config found.",
        };
      }

      const response = await supabase
        .from("user_profiles")
        .upsert(toRow(sanitizedProfile, session.user.id), { onConflict: "user_id" })
        .select("*")
        .single();

      if (!pendingSaveRequests.has(requestId)) {
        return {
          profile: sanitizedProfile,
          savedLocally: true,
          syncedToSupabase: false,
          syncError: "Save request was superseded during the Supabase operation.",
        };
      }

      if (response.error) {
        console.warn("[ProfileService] Supabase profile save failed", response.error.message);
        return {
          profile: sanitizedProfile,
          savedLocally: true,
          syncedToSupabase: false,
          syncError: response.error.message,
        };
      }

      const remoteProfile = fromRow(response.data as Partial<UserProfileRow>);
      await saveLocalProfile(remoteProfile);

      return {
        profile: remoteProfile,
        savedLocally: true,
        syncedToSupabase: true,
        syncError: null,
      };
    } finally {
      pendingSaveRequests.delete(requestId);
    }
  },
};
