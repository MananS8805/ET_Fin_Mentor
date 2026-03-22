import { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

import {
  DemoPersonaKey,
  PortfolioXRay,
  UserProfileData,
  getDemoProfile,
  calculateXIRR,
  getCategoryAllocation,
  getExpenseRatioDrag,
  getOverlapPairs,
} from "../models/UserProfile";
import { ChatMessage, GeminiService } from "./GeminiService";

// ─── types ────────────────────────────────────────────────────────────────────

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AppState {
  authStatus:     AuthStatus;
  session:        Session | null;
  currentProfile: UserProfileData | null;
  demoMode:       boolean;
  demoPersona:    DemoPersonaKey | null;
  chatHistory:    ChatMessage[];
  portfolioXRay:  PortfolioXRay | null;
  jointProfile:   import("../models/UserProfile").JointProfileData | null;

  setAuthStatus:    (status: AuthStatus) => void;
  setSession:       (session: Session | null) => void;
  setCurrentProfile:(profile: UserProfileData | null) => void;
  setDemoMode:      (enabled: boolean, persona?: DemoPersonaKey | null) => void;
  selectDemoPersona:(persona: DemoPersonaKey) => void;
  addChatMessage:   (message: ChatMessage) => void;
  setChatHistory:   (history: ChatMessage[]) => void;
  clearChatHistory: () => void;
  setPortfolioXRay: (xray: PortfolioXRay | null) => void;
  setJointProfile:  (jointProfile: import("../models/UserProfile").JointProfileData | null) => void;
  reset:            () => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildPortfolioXRay(profile: UserProfileData): PortfolioXRay | null {
  const holdings = profile.camsData?.holdings;
  if (!holdings || holdings.length === 0) return null;

  const totalValue    = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.purchaseValue, 0);

  // Build cashflows only from real transaction data — no fake 6-month fallback
  const allCashflows: Array<{ date: Date; amount: number }> = [];

  holdings.forEach((h) => {
    if (h.transactions && h.transactions.length > 0) {
      h.transactions.forEach((t) => {
        allCashflows.push({ date: new Date(t.date), amount: -Math.abs(t.amount) });
      });
    } else if (h.purchaseDate) {
      allCashflows.push({ date: new Date(h.purchaseDate), amount: -h.purchaseValue });
    }
    // no purchase date → skip from XIRR; holding still counts toward totals
  });

  let overallXIRR: number | null = null;
  if (allCashflows.length > 0 && totalValue > 0) {
    allCashflows.push({ date: new Date(), amount: totalValue });
    overallXIRR = calculateXIRR(allCashflows);
  }

  return {
    holdings,
    totalValue,
    totalInvested,
    overallXIRR,
    overlapPairs:       getOverlapPairs(holdings),
    expenseRatioDrag:   getExpenseRatioDrag(holdings),
    categoryAllocation: getCategoryAllocation(holdings),
  };
}

// ─── initial state ────────────────────────────────────────────────────────────

const initialState = {
  authStatus:     "idle" as AuthStatus,
  session:        null as Session | null,
  currentProfile: null as UserProfileData | null,
  demoMode:       false,
  demoPersona:    null as DemoPersonaKey | null,
  chatHistory:    [] as ChatMessage[],
  portfolioXRay:  null as PortfolioXRay | null,
  jointProfile:   null as import("../models/UserProfile").JointProfileData | null,
};

// ─── store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setAuthStatus: (authStatus) => set({ authStatus }),

  setSession: (session) =>
    set({
      session,
      authStatus: session ? "authenticated" : "unauthenticated",
    }),

  // Auto-computes portfolioXRay from holdings whenever a profile is loaded —
  // so dashboard XIRR is available from first load without visiting portfolio-xray screen.
  setCurrentProfile: (currentProfile) => {
    if (currentProfile?.camsData?.holdings?.length) {
      set({ currentProfile, portfolioXRay: buildPortfolioXRay(currentProfile) });
    } else {
      set({ currentProfile });
    }
  },

  setDemoMode: (enabled, persona = null) => {
    GeminiService.clearHistory();
    const profile = enabled && persona ? getDemoProfile(persona) : null;
    set({
      demoMode:     enabled,
      demoPersona:  enabled && persona ? persona : null,
      currentProfile: profile,
      portfolioXRay:  profile ? buildPortfolioXRay(profile) : null,
      session:      enabled ? null : initialState.session,
      authStatus:   enabled ? "authenticated" : "unauthenticated",
      chatHistory:  [],
    });
  },

  selectDemoPersona: (persona) => {
    GeminiService.clearHistory();
    const profile = getDemoProfile(persona);
    set({
      demoMode:       true,
      demoPersona:    persona,
      currentProfile: profile,
      portfolioXRay:  buildPortfolioXRay(profile),
      authStatus:     "authenticated",
      chatHistory:    [],
    });
  },

  addChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  setChatHistory:   (chatHistory) => set({ chatHistory }),

  clearChatHistory: () => {
    GeminiService.clearHistory();
    set({ chatHistory: [] });
  },

  setPortfolioXRay: (portfolioXRay) => set({ portfolioXRay }),

  setJointProfile: (jointProfile) => {
    if (jointProfile) {
      void SecureStore.setItemAsync(
        "et_finmentor_joint_profile",
        JSON.stringify(jointProfile),
        { keychainService: "et-finmentor" }
      ).catch((e) => console.warn("[Store] Failed to persist joint profile:", e));
    } else {
      void SecureStore.deleteItemAsync(
        "et_finmentor_joint_profile",
        { keychainService: "et-finmentor" }
      ).catch(() => undefined);
    }
    set({ jointProfile });
  },

  reset: () => {
    GeminiService.clearHistory();
    set({
      ...initialState,
      authStatus: "unauthenticated",
    });
  },
}));