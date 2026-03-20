import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Colors, Spacing, Typography } from "../../../src/core/theme";
import { Button } from "../../../src/components/Button";

interface SchemeInputFormProps {
  onSubmit: (schemeCodes: string[]) => void;
  isLoading?: boolean;
  maxSchemes?: number;
}

/**
 * Scheme Input Form Component
 * Dual input methods:
 * 1. Manual scheme code entry (text input)
 * 2. OCR extraction from documents (image picker)
 */
export function SchemeInputForm({
  onSubmit,
  isLoading = false,
  maxSchemes = 20,
}: SchemeInputFormProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "ocr">("manual");
  const [manualInput, setManualInput] = useState("");
  const [extractedCodes, setExtractedCodes] = useState<string[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Common AMFI scheme codes for validation
  const VALID_SCHEME_CODE_PATTERN = /^\d{6}$/;

  // Parse manual input - expects comma or newline separated scheme codes
  const parseManualInput = useCallback((input: string): string[] => {
    return input
      .split(/[,\n]+/)
      .map((code) => code.trim())
      .filter((code) => VALID_SCHEME_CODE_PATTERN.test(code));
  }, []);

  // Handle manual input submission
  const handleManualSubmit = useCallback(() => {
    const codes = parseManualInput(manualInput);

    if (codes.length === 0) {
      Alert.alert(
        "Invalid Input",
        "Please enter valid 6-digit AMFI scheme codes separated by commas or newlines.",
      );
      return;
    }

    if (codes.length > maxSchemes) {
      Alert.alert("Too Many Schemes", `Maximum ${maxSchemes} schemes allowed per request.`);
      return;
    }

    onSubmit(codes);
    setManualInput("");
  }, [manualInput, onSubmit, maxSchemes, parseManualInput]);

  // Handle OCR document picking
  const handlePickDocument = useCallback(async () => {
    setOcrLoading(true);

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need access to your photo library to extract scheme codes.",
        );
        setOcrLoading(false);
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) {
        setOcrLoading(false);
        return;
      }

      // In a real app, you would send this to OCR API (like Tesseract.js or ocr.space)
      // For now, we'll mock the extraction
      await simulateOCRExtraction(result.assets[0].uri);
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to process image. Please try again.");
    } finally {
      setOcrLoading(false);
    }
  }, []);

  // Mock OCR extraction
  const simulateOCRExtraction = useCallback(async (imageUri: string) => {
    // In production, integrate with actual OCR service
    // This is a placeholder that would call an OCR API
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock extraction - in real app, OCR service would extract from image
      const mockExtractedCodes = ["112087", "101253", "100070"];

      setExtractedCodes(mockExtractedCodes);
      Alert.alert(
        "Success",
        `Extracted ${mockExtractedCodes.length} scheme codes from document.`,
      );
    } catch (error) {
      console.error("OCR extraction error:", error);
      Alert.alert("Extraction Failed", "Could not extract scheme codes from image.");
    }
  }, []);

  // Handle extracted codes submission
  const handleOCRSubmit = useCallback(() => {
    if (extractedCodes.length === 0) {
      Alert.alert("No Codes", "No scheme codes were extracted. Please try another document.");
      return;
    }

    onSubmit(extractedCodes);
    setExtractedCodes([]);
  }, [extractedCodes, onSubmit]);

  // Remove extracted code
  const removeExtractedCode = useCallback(
    (index: number) => {
      setExtractedCodes((prev) => prev.filter((_, i) => i !== index));
    },
    [],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New Funds to Portfolio</Text>
      <Text style={styles.subtitle}>
        Enter scheme codes or upload a portfolio statement to extract them
      </Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "manual" && styles.tabActive]}
          onPress={() => setActiveTab("manual")}
        >
          <Text style={[styles.tabLabel, activeTab === "manual" && styles.tabLabelActive]}>
            Manual Entry
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "ocr" && styles.tabActive]}
          onPress={() => setActiveTab("ocr")}
        >
          <Text style={[styles.tabLabel, activeTab === "ocr" && styles.tabLabelActive]}>
            OCR Extract
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Entry Tab */}
      {activeTab === "manual" && (
        <View style={styles.tabContent}>
          <Text style={styles.label}>Scheme Codes</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter 6-digit scheme codes&#10;Separate by comma or newline&#10;Example: 112087, 101253, 100070"
            placeholderTextColor="#888888"
            multiline
            numberOfLines={6}
            value={manualInput}
            onChangeText={setManualInput}
            editable={!isLoading}
          />

          <View style={styles.helperText}>
            <Text style={styles.helperTextContent}>
              💡 Find scheme codes at{" "}
              <Text style={styles.helperTextLink}>amfiindia.com</Text> or your statement
            </Text>
          </View>

          <Button
            label={isLoading ? "Processing..." : "Add Schemes"}
            onPress={handleManualSubmit}
            variant="primary"
            disabled={isLoading || manualInput.trim().length === 0}
          />
        </View>
      )}

      {/* OCR Tab */}
      {activeTab === "ocr" && (
        <View style={styles.tabContent}>
          <Text style={styles.label}>Upload Statement</Text>

          <TouchableOpacity
            style={styles.uploadBox}
            onPress={handlePickDocument}
            disabled={ocrLoading}
          >
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadTitle}>Tap to upload</Text>
            <Text style={styles.uploadSubtitle}>CAMS, KFintech, or any portfolio statement</Text>
          </TouchableOpacity>

          {/* Extracted Codes */}
          {extractedCodes.length > 0 && (
            <View style={styles.extractedContainer}>
              <Text style={styles.extractedTitle}>Extracted Scheme Codes</Text>
              <ScrollView style={styles.codesList}>
                {extractedCodes.map((code, index) => (
                  <View key={index} style={styles.codeChip}>
                    <Text style={styles.codeText}>{code}</Text>
                    <TouchableOpacity
                      onPress={() => removeExtractedCode(index)}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeIcon}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <Button
            label={ocrLoading ? "Extracting..." : "Upload & Extract"}
            onPress={handlePickDocument}
            variant="secondary"
            disabled={ocrLoading}
          />

          {extractedCodes.length > 0 && (
            <Button
              label={isLoading ? "Processing..." : "Add Extracted Schemes"}
              onPress={handleOCRSubmit}
              variant="primary"
              disabled={isLoading || extractedCodes.length === 0}
            />
          )}
        </View>
      )}

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>✓ Valid Schemes</Text>
        <Text style={styles.infoText}>
          Schemes must be 6-digit AMFI codes. Common formats: Equity, Debt, Hybrid, ELSS, etc.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },

  title: {
    fontSize: Typography.size.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  subtitle: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },

  tabContainer: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 4,
  },

  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: 6,
  },

  tabActive: {
    backgroundColor: Colors.navy,
  },

  tabLabel: {
    fontSize: Typography.size.md,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  tabLabelActive: {
    color: "#FFFFFF",
  },

  tabContent: {
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: Typography.size.xs,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },

  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: Typography.size.md,
    color: "#FFFFFF", // Forced pure white
    backgroundColor: "#1A1A1A", // Forced dark grey, bypasses Colors.surface inversion
    textAlignVertical: "top",
    minHeight: 120,
    marginBottom: Spacing.md,
  },

  helperText: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold,
    borderRadius: 4,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },

  helperTextContent: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  helperTextLink: {
    color: Colors.navy,
    fontWeight: "600",
  },

  uploadBox: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
  },

  uploadIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },

  uploadTitle: {
    fontSize: Typography.size.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  uploadSubtitle: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  },

  extractedContainer: {
    marginBottom: Spacing.lg,
  },

  extractedTitle: {
    fontSize: Typography.size.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  codesList: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },

  codeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.navy,
    borderRadius: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },

  codeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: Typography.size.md,
  },

  removeButton: {
    padding: Spacing.sm,
  },

  removeIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  infoBox: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: Colors.teal,
    borderRadius: 8,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },

  infoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.teal,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },

  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
