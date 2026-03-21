import { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import {
  DemoPersonaKey,
  PortfolioXRay,
  UserProfileData,
  getDemoProfile,
} from "../models/UserProfile";
import { ChatMessage, GeminiService } from "./GeminiService";
import * as SecureStore from "expo-secure-store";
type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AppState {
  authStatus: AuthStatus;
  session: Session | null;
  currentProfile: UserProfileData | null;
  demoMode: boolean;
  demoPersona: DemoPersonaKey | null;
  chatHistory: ChatMessage[];
  portfolioXRay: PortfolioXRay | null;
  jointProfile: import("../models/UserProfile").JointProfileData | null;
  setAuthStatus: (status: AuthStatus) => void;
  setSession: (session: Session | null) => void;
  setCurrentProfile: (profile: UserProfileData | null) => void;
  setDemoMode: (enabled: boolean, persona?: DemoPersonaKey | null) => void;
  selectDemoPersona: (persona: DemoPersonaKey) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatHistory: (history: ChatMessage[]) => void;
  clearChatHistory: () => void;
  setPortfolioXRay: (xray: PortfolioXRay | null) => void;
  setJointProfile: (jointProfile: import("../models/UserProfile").JointProfileData | null) => void;
  reset: () => void;
}

const initialState = {
  authStatus: "idle" as AuthStatus,
  session: null as Session | null,
  currentProfile: null as UserProfileData | null,
  demoMode: false,
  demoPersona: null as DemoPersonaKey | null,
  chatHistory: [] as ChatMessage[],
  portfolioXRay: null as PortfolioXRay | null,
  jointProfile: null as import("../models/UserProfile").JointProfileData | null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setAuthStatus: (authStatus) => set({ authStatus }),

  setSession: (session) =>
    set({
      session,
      authStatus: session ? "authenticated" : "unauthenticated",
    }),

  setCurrentProfile: (currentProfile) => set({ currentProfile }),

  setDemoMode: (enabled, persona = null) => {
    GeminiService.clearHistory();
    set({
      demoMode: enabled,
      demoPersona: enabled && persona ? persona : null,
      currentProfile: enabled && persona ? getDemoProfile(persona) : null,
      session: enabled ? null : initialState.session,
      authStatus: enabled ? "authenticated" : "unauthenticated",
      chatHistory: [],
      portfolioXRay: null,
    });
  },

  selectDemoPersona: (persona) => {
    GeminiService.clearHistory();
    set({
      demoMode: true,
      demoPersona: persona,
      currentProfile: getDemoProfile(persona),
      authStatus: "authenticated",
      chatHistory: [],
      portfolioXRay: null,
    });
  },

  addChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  setChatHistory: (chatHistory) => set({ chatHistory }),

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