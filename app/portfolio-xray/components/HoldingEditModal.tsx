import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { MFHolding } from "../../../src/core/models/UserProfile";
import { Colors, Spacing, Typography } from "../../../src/core/theme";
import { Button } from "../../../src/components/Button";
import { MFSchemeService, MFScheme } from "../../../src/core/services/MFSchemeService";

interface HoldingEditModalProps {
  holding: MFHolding;
  isVisible: boolean;
  onClose: () => void;
  onSave: (updatedHolding: MFHolding) => void;
  onDelete?:() => void; // Optional delete handler
}

const CATEGORIES: Array<MFHolding["category"]> = [
  "large_cap",
  "mid_cap",
  "small_cap",
  "elss",
  "debt",
  "hybrid",
  "liquid",
  "other",
];

const CATEGORY_LABELS: Record<MFHolding["category"], string> = {
  large_cap: "Large Cap",
  mid_cap: "Mid Cap",
  small_cap: "Small Cap",
  elss: "ELSS",
  debt: "Debt",
  hybrid: "Hybrid",
  liquid: "Liquid",
  other: "Other",
};

export function HoldingEditModal({
  holding,
  isVisible,
  onClose,
  onSave,
  onDelete,
}: HoldingEditModalProps) {
  const [schemeCode, setSchemeCode] = useState(holding.schemeCode ?? "");
  const [fetchedScheme, setFetchedScheme] = useState<MFScheme | null>(null);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeError, setSchemeError] = useState("");

  const [name, setName] = useState(holding.name);
  const [units, setUnits] = useState(holding.units.toString());
  const [nav, setNav] = useState(holding.nav.toString());
  const [currentValue, setCurrentValue] = useState(holding.currentValue.toString());
  const [purchaseValue, setPurchaseValue] = useState(holding.purchaseValue.toString());
  const [selectedCategory, setSelectedCategory] = useState(holding.category);
  const [calcSuccess, setCalcSuccess] = useState(false);

  // Sync state when holding prop changes
  useEffect(() => {
    if (isVisible) {
      setSchemeCode(holding.schemeCode ?? "");
      setFetchedScheme(null);
      setSchemeError("");
      setName(holding.name);
      setUnits(holding.units.toString());
      setNav(holding.nav.toString());
      setCurrentValue(holding.currentValue.toString());
      setPurchaseValue(holding.purchaseValue.toString());
      setSelectedCategory(holding.category);
    }
  }, [holding.id, isVisible]);
  useEffect(() => {
    if (!schemeCode.trim()) {
      setFetchedScheme(null);
      setSchemeError("");
      return;
    }

    setSchemeLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const scheme = await MFSchemeService.fetchScheme(schemeCode);
        setFetchedScheme(scheme);
        setSchemeError("");
      } catch (error) {
        setFetchedScheme(null);
        setSchemeError(error instanceof Error ? error.message : "Failed to fetch scheme details");
      } finally {
        setSchemeLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [schemeCode]);

  const handleSave = () => {
    // Validate inputs
    const parsedUnits = parseFloat(units);
    const parsedNav = parseFloat(nav);
    const parsedCurrentValue = parseFloat(currentValue);
    const parsedPurchaseValue = parseFloat(purchaseValue);

    if (
      isNaN(parsedUnits) ||
      isNaN(parsedNav) ||
      isNaN(parsedCurrentValue) ||
      isNaN(parsedPurchaseValue)
    ) {
      Alert.alert("Invalid Input", "All numeric fields must be valid numbers.");
      return;
    }

    if (parsedUnits < 0 || parsedNav < 0 || parsedCurrentValue < 0 || parsedPurchaseValue < 0) {
      Alert.alert("Invalid Input", "All numeric fields must be non-negative.");
      return;
    }

    if (parsedUnits <= 0 || parsedNav <= 0) {
      Alert.alert("Invalid Input", "Units and NAV must be greater than 0.");
      return;
    }

    if (!name.trim()) {
      Alert.alert("Invalid Input", "Fund name cannot be empty.");
      return;
    }

    const updatedHolding: MFHolding = {
      ...holding,
      name: name.trim(),
      schemeCode:    schemeCode.trim() || undefined,
      units: parsedUnits,
      nav: parsedNav,
      currentValue: parsedCurrentValue,
      purchaseValue: parsedPurchaseValue,
      category: selectedCategory,
      xirr: holding.xirr, // Preserve existing XIRR; can be updated separately if data changes
    };

    onSave(updatedHolding);
  };

  const handleAutoCalculateCurrentValue = () => {
    const parsedUnits = parseFloat(units);
    const parsedNav = parseFloat(nav);

    if (!isNaN(parsedUnits) && !isNaN(parsedNav) && parsedUnits > 0 && parsedNav > 0) {
      setCurrentValue((parsedUnits * parsedNav).toFixed(2));
      setCalcSuccess(true);
      setTimeout(() => setCalcSuccess(false), 2000); // Hide success feedback after 2 seconds
    } else {
      Alert.alert("Invalid Input", "Please enter valid Units and NAV values first.");
    }
  };

  // Filter negative signs and ensure only valid decimal numbers
  const filterDecimalInput = (text: string): string => {
    // Remove leading negative signs
    const cleaned = text.replace(/^-+/, "");
    // Allow only digits and a single decimal point
    return cleaned.replace(/[^\d.]/g, "").split(".").slice(0, 2).join(".");
  };

  const handleApplySchemeDetails = () => {
    if (!fetchedScheme) return;

    setName(fetchedScheme.schemeName);
    setNav(fetchedScheme.nav.toFixed(4));
    setSelectedCategory(fetchedScheme.category);

    // Auto-calculate current value if units are set
    const parsedUnits = parseFloat(units);
    if (!isNaN(parsedUnits) && parsedUnits > 0) {
      setCurrentValue((parsedUnits * fetchedScheme.nav).toFixed(2));
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Holding</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Scheme Code Lookup */}
            <View style={styles.section}>
              <Text style={styles.label}>Scheme Code (Optional)</Text>
              <View style={styles.schemeInputRow}>
                <TextInput
                  style={[styles.input, styles.schemeInput]}
                  value={schemeCode}
                  onChangeText={setSchemeCode}
                  placeholder="e.g., 119551"
                  placeholderTextColor={Colors.textMuted}
                />
                {schemeLoading && (
                  <ActivityIndicator
                    size="small"
                    color={Colors.navy}
                    style={styles.schemeLoadingSpinner}
                  />
                )}
              </View>
              <Text style={styles.schemeHint}>
                Enter the AMFI scheme code to auto-fetch fund details
              </Text>
            </View>

            {/* Fetched Scheme Details Card */}
            {schemeError && (
              <View style={[styles.schemeCard, styles.schemeCardError]}>
                <Text style={styles.schemeCardErrorText}>{schemeError}</Text>
              </View>
            )}

            {fetchedScheme && !schemeError && (
              <View style={[styles.schemeCard, styles.schemeCardSuccess]}>
                <View style={styles.schemeCardHeader}>
                  <Text style={styles.schemeCardTitle}>Fund Details</Text>
                  <TouchableOpacity onPress={handleApplySchemeDetails}>
                    <Text style={styles.applyText}>Apply →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.schemeDetailRow}>
                  <Text style={styles.schemeDetailLabel}>Fund Name</Text>
                  <Text style={styles.schemeDetailValue}>{fetchedScheme.schemeName}</Text>
                </View>

                <View style={styles.schemeDetailRow}>
                  <Text style={styles.schemeDetailLabel}>NAV</Text>
                  <Text style={[styles.schemeDetailValue, styles.schemeDetailValueHighlight]}>
                    ₹{fetchedScheme.nav.toFixed(4)}
                  </Text>
                </View>

                <View style={styles.schemeDetailRow}>
                  <Text style={styles.schemeDetailLabel}>Fund Manager</Text>
                  <Text style={styles.schemeDetailValue}>{fetchedScheme.fundManager}</Text>
                </View>

                <View style={styles.schemeDetailRow}>
                  <Text style={styles.schemeDetailLabel}>Expense Ratio</Text>
                  <Text style={styles.schemeDetailValue}>{fetchedScheme.expenseRatio.toFixed(2)}%</Text>
                </View>
              </View>
            )}

            {/* Fund Name */}
            <View style={styles.section}>
              <Text style={styles.label}>Fund Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Mirae Asset Large Cap Fund"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      selectedCategory === cat && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === cat && styles.categoryButtonTextActive,
                      ]}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Units & NAV Row */}
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Units</Text>
                  <TextInput
                    style={styles.input}
                    value={units}
                    onChangeText={(text) => setUnits(filterDecimalInput(text))}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>NAV</Text>
                  <TextInput
                    style={styles.input}
                    value={nav}
                    onChangeText={(text) => setNav(filterDecimalInput(text))}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Auto-calculate button */}
              <TouchableOpacity
                style={[styles.autoCalcButton, calcSuccess && styles.autoCalcButtonSuccess]}
                onPress={handleAutoCalculateCurrentValue}
              >
                <Text style={styles.autoCalcText}>
                  {calcSuccess ? "✓ Calculated!" : "Auto-calculate Current Value (Units × NAV)"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Current & Purchase Value Row */}
            <View style={styles.section}>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Current Value</Text>
                  <TextInput
                    style={styles.input}
                    value={currentValue}
                    onChangeText={(text) => setCurrentValue(filterDecimalInput(text))}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Purchase Value</Text>
                  <TextInput
                    style={styles.input}
                    value={purchaseValue}
                    onChangeText={(text) => setPurchaseValue(filterDecimalInput(text))}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>💡 Tip</Text>
              <Text style={styles.infoText}>
                Current Value = Units × NAV. Use "Auto-calculate" to compute from units and NAV, or enter manually.
              </Text>
            </View>
          </ScrollView>

{/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            {onDelete ? (
              <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },

  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: Spacing.lg,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  closeButton: {
    padding: Spacing.sm,
  },

  closeIcon: {
    fontSize: 24,
    color: Colors.textSecondary,
  },

  form: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  section: {
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: Typography.size.sm,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.size.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },

  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },

  halfInput: {
    flex: 1,
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  categoryButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  categoryButtonActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
    elevation: 2,
    shadowOpacity: 0.2,
  },

  categoryButtonText: {
    fontSize: Typography.size.xs,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  categoryButtonTextActive: {
    color: "#FFFFFF",
  },

  autoCalcButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.navy,
    borderRadius: 8,
    alignItems: "center",
  },

  autoCalcButtonSuccess: {
    backgroundColor: Colors.teal,
  },

  autoCalcText: {
    color: "#FFFFFF",
    fontSize: Typography.size.sm,
    fontWeight: "600",
  },

  infoBox: {
    backgroundColor: "#F0F8FF",
    borderLeftWidth: 4,
    borderLeftColor: Colors.navy,
    borderRadius: 8,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },

  infoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navy,
    marginBottom: Spacing.sm,
  },

  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  footer: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  schemeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },

  schemeInput: {
    flex: 1,
  },

  schemeLoadingSpinner: {
    position: "absolute",
    right: Spacing.md,
  },

  schemeHint: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },

  schemeCard: {
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },

  schemeCardSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },

  schemeCardError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },

  schemeCardErrorText: {
    color: "#DC2626",
    fontSize: Typography.size.sm,
    fontWeight: "500",
  },

  schemeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#86EFAC",
  },

  schemeCardTitle: {
    fontSize: Typography.size.md,
    fontWeight: "700",
    color: "#15803D",
  },

  applyText: {
    color: "#15803D",
    fontSize: Typography.size.sm,
    fontWeight: "600",
  },

  schemeDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },

  schemeDetailLabel: {
    fontSize: Typography.size.sm,
    fontWeight: "600",
    color: "#4B5563",
    flex: 1,
  },

  schemeDetailValue: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: "right",
    fontWeight: "500",
  },

  schemeDetailValueHighlight: {
    color: Colors.navy,
    fontWeight: "700",
  },
cancelBtn: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#1E1E23",
  borderRadius: 100,
  borderWidth: 0.5,
  borderColor: "rgba(255,255,255,0.09)",
  paddingVertical: 14,
},
cancelBtnText: {
  color: "#9A9A94",
  fontSize: 15,
  fontWeight: "500",
},
deleteBtn: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 100,
  borderWidth: 0.5,
  borderColor: "rgba(220,78,78,0.3)",
  paddingVertical: 14,
},
deleteBtnText: {
  color: "#DC4E4E",
  fontSize: 15,
  fontWeight: "500",
},
saveBtn: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#C8A84B",
  borderRadius: 100,
  paddingVertical: 14,
},
saveBtnText: {
  color: "#0B0B0D",
  fontSize: 15,
  fontWeight: "600",
},

});
