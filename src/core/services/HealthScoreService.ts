import * as SecureStore from "expo-secure-store";

import { StorageKeys } from "../config";
import { HealthScoreDimensions, getHealthScoreDimensions, getOverallHealthScore, UserProfileData } from "../models/UserProfile";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "et-finmentor",
};

export interface HealthScoreSnapshot {
  monthKey: string;   // "YYYY-MM"
  score: number;
  dimensions: HealthScoreDimensions;
}

async function readHistory(): Promise<HealthScoreSnapshot[]> {
  const raw = await SecureStore.getItemAsync(StorageKeys.healthScoreHistory, SECURE_STORE_OPTIONS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HealthScoreSnapshot[]) : [];
  } catch {
    return [];
  }
}

async function writeHistory(history: HealthScoreSnapshot[]) {
  await SecureStore.setItemAsync(
    StorageKeys.healthScoreHistory,
    JSON.stringify(history),
    SECURE_STORE_OPTIONS
  );
}

export const HealthScoreService = {
  async getHistory(): Promise<HealthScoreSnapshot[]> {
    return readHistory();
  },

  // Saves one snapshot per calendar month — upserts if same month already exists
  async saveScore(profile: UserProfileData): Promise<HealthScoreSnapshot[]> {
    const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const snapshot: HealthScoreSnapshot = {
      monthKey,
      score: getOverallHealthScore(profile),
      dimensions: getHealthScoreDimensions(profile),
    };

    const history = await readHistory();
    const filtered = history.filter((h) => h.monthKey !== monthKey);
    const next = [...filtered, snapshot].sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-6);
    await writeHistory(next);
    return next;
  },

  async clearHistory() {
    await SecureStore.deleteItemAsync(StorageKeys.healthScoreHistory, SECURE_STORE_OPTIONS);
  },
};