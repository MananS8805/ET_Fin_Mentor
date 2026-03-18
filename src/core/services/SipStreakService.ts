import * as SecureStore from "expo-secure-store";

import { StorageKeys } from "../config";
import { getMonthKey, getSipMilestone, getSipStreakCount } from "../models/UserProfile";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "et-finmentor",
};

async function readLogs(): Promise<string[]> {
  const rawValue = await SecureStore.getItemAsync(StorageKeys.sipLogs, SECURE_STORE_OPTIONS);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").sort() : [];
  } catch (error) {
    console.warn("[SipStreakService] Failed to parse SIP logs", error);
    return [];
  }
}

async function writeLogs(logs: string[]) {
  await SecureStore.setItemAsync(StorageKeys.sipLogs, JSON.stringify(logs), SECURE_STORE_OPTIONS);
}

export const SipStreakService = {
  async getLogs() {
    return readLogs();
  },

  async clearLogs() {
    await SecureStore.deleteItemAsync(StorageKeys.sipLogs, SECURE_STORE_OPTIONS);
  },

  async logMonth(date = new Date()) {
    const monthKey = getMonthKey(date);
    const logs = await readLogs();

    if (logs.includes(monthKey)) {
      const streak = getSipStreakCount(logs, date);
      return {
        logs,
        streak,
        milestone: getSipMilestone(streak),
        alreadyLogged: true,
      };
    }

    const nextLogs = [...logs, monthKey].sort();
    await writeLogs(nextLogs);

    const streak = getSipStreakCount(nextLogs, date);

    return {
      logs: nextLogs,
      streak,
      milestone: getSipMilestone(streak),
      alreadyLogged: false,
    };
  },
};
