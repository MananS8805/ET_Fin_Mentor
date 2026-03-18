import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

import { StorageKeys } from "../config";
import { FinancialAlert, FinancialAlertType, UserProfileData, getFinancial911Alerts } from "../models/UserProfile";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "et-finmentor",
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

async function readJsonArray(key: string): Promise<string[]> {
  const rawValue = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (error) {
    console.warn("[AlertService] Failed to parse secure-store array", error);
    return [];
  }
}

async function writeJsonArray(key: string, value: string[]) {
  await SecureStore.setItemAsync(key, JSON.stringify(value), SECURE_STORE_OPTIONS);
}

export const AlertService = {
  async getDismissedAlertIds() {
    return readJsonArray(StorageKeys.dismissedAlerts);
  },

  async dismissAlert(alertId: FinancialAlertType) {
    const dismissed = await this.getDismissedAlertIds();

    if (!dismissed.includes(alertId)) {
      await writeJsonArray(StorageKeys.dismissedAlerts, [...dismissed, alertId]);
    }
  },

  async resetDismissedAlerts() {
    await SecureStore.deleteItemAsync(StorageKeys.dismissedAlerts, SECURE_STORE_OPTIONS);
  },

  async getActiveAlerts(profile: UserProfileData): Promise<FinancialAlert[]> {
    const dismissed = new Set(await this.getDismissedAlertIds());
    return getFinancial911Alerts(profile).filter((alert) => !dismissed.has(alert.id));
  },

  async syncNotifications(alerts: FinancialAlert[]) {
    const signature = alerts.map((alert) => alert.id).sort().join("|");
    const previousSignature =
      (await SecureStore.getItemAsync(StorageKeys.alertNotificationSignature, SECURE_STORE_OPTIONS)) ?? "";

    if (signature === previousSignature) {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!alerts.length) {
      await SecureStore.setItemAsync(StorageKeys.alertNotificationSignature, signature, SECURE_STORE_OPTIONS);
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    const granted =
      permission.granted || (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) {
      return;
    }

    for (const [index, alert] of alerts.entries()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "ET FinMentor Alert",
          body: "You have a financial 911 alert to review in the app.",
          data: {
            alertId: alert.id,
          },
        },
        trigger: {
          seconds: index + 1,
        },
      });
    }

    await SecureStore.setItemAsync(StorageKeys.alertNotificationSignature, signature, SECURE_STORE_OPTIONS);
  },
};

