export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  if (digits.length >= 12 && digits.startsWith("91")) {
    // Handle case where user pastes "+91XXXXXXXXXX" and we extract only relevant digits
    return `+${digits.slice(0, 12)}`;
  }

  throw new Error("Please enter a valid 10-digit Indian mobile number.");
}
