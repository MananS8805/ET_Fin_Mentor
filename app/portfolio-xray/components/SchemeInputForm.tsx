import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { Colors, Spacing, Typography } from "../../../src/core/theme";
import { Button } from "../../../src/components/Button";

interface SchemeInputFormProps {
  onSubmit: (schemeCodes: string[]) => void;
  isLoading?: boolean;
  maxSchemes?: number;
}

export function SchemeInputForm({
  onSubmit,
  isLoading = false,
  maxSchemes = 20,
}: SchemeInputFormProps) {
  const [manualInput, setManualInput] = useState("");

  const VALID_SCHEME_CODE_PATTERN = /^\d{6}$/;

  const parseManualInput = useCallback((input: string): string[] => {
    return input
      .split(/[,\n]+/)
      .map((code) => code.trim())
      .filter((code) => VALID_SCHEME_CODE_PATTERN.test(code));
  }, []);

  const handleManualSubmit = useCallback(() => {
    const codes = parseManualInput(manualInput);

    if (codes.length === 0) {
      Alert.alert(
        "Invalid input",
        "Please enter valid 6-digit AMFI scheme codes separated by commas or newlines.\n\nExample: 120503, 119598"
      );
      return;
    }

    if (codes.length > maxSchemes) {
      Alert.alert("Too many schemes", `Maximum ${maxSchemes} schemes allowed at once.`);
      return;
    }

    onSubmit(codes);
    setManualInput("");
  }, [manualInput, onSubmit, maxSchemes, parseManualInput]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add funds by scheme code</Text>
      <Text style={styles.subtitle}>
        Enter 6-digit AMFI scheme codes — find them at amfiindia.com or on your fund's fact sheet.
      </Text>

      {/* Manual entry */}
      <Text style={styles.label}>Scheme codes</Text>
      <TextInput
        style={styles.textInput}
        placeholder={"Enter codes separated by comma or newline\nExample: 120503, 119598, 100070"}
        placeholderTextColor="rgba(255,255,255,0.25)"
        multiline
        numberOfLines={5}
        value={manualInput}
        onChangeText={setManualInput}
        editable={!isLoading}
        keyboardType="numeric"
      />

      <Button
        label={isLoading ? "Fetching funds..." : "Add schemes"}
        onPress={handleManualSubmit}
        variant="primary"
        disabled={isLoading || manualInput.trim().length === 0}
        style={styles.addButton}
      />

      {/* How to find scheme codes */}
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>How to find scheme codes</Text>
        <Text style={styles.tipBody}>
          1. Visit amfiindia.com → NAV History{"\n"}
          2. Search your fund name{"\n"}
          3. Copy the 6-digit scheme code{"\n"}
          4. Paste it above — add multiple codes separated by commas
        </Text>
      </View>

      {/* CAMS upload hint */}
      <View style={styles.camsHint}>
        <Text style={styles.camsHintTitle}>Have a CAMS or KFintech statement?</Text>
        <Text style={styles.camsHintBody}>
          Use the "Upload CAMS / KFintech" button below to automatically extract all your holdings from a screenshot.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 16,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: "#0D0D0D",
    borderColor: "#2A2A2A",
    borderRadius: 14,
    borderWidth: 0.5,
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.body,
    fontSize: 15,
    padding: 14,
    textAlignVertical: "top",
    minHeight: 110,
  },
  tipBox: {
    backgroundColor: "rgba(212,175,55,0.04)",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#D4AF37",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 10,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tipTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textPrimary,
  },
  tipBody: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  addButton: {
    borderRadius: 99,
    minHeight: 52,
  },
  camsHint: {
    backgroundColor: "#1A1A2E",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.purple,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  camsHintTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.purple,
  },
  camsHintBody: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});