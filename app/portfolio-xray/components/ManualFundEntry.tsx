import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Button } from "../../../src/components/Button";
import { Colors, Radius, Spacing, Typography } from "../../../src/core/theme";
import { formatINR } from "../../../src/core/models/UserProfile";
import * as Animatable from "react-native-animatable";

interface ManualFundEntryProps {
  onAddFund: (fund: any) => void;
}

export default function ManualFundEntry({ onAddFund }: ManualFundEntryProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [fundData, setFundData] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchFund = async () => {
    if (!code) return;
    setLoading(true);
    setError("");
    setFundData(null);
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${code}`);
      const json = await res.json();
      if (json.status !== "SUCCESS") {
        throw new Error("Fund not found");
      }
      setFundData(json);
    } catch (e) {
      setError("Failed to fetch fund. Check Scheme Code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animatable.View animation="fadeInUp" duration={500} style={styles.container}>
      <Text style={styles.title}>Add Fund by Scheme Code</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. 120503"
          placeholderTextColor="#888888"
          keyboardType="numeric"
          value={code}
          onChangeText={setCode}
        />
        <Button label="Fetch" onPress={() => void fetchFund()} loading={loading} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {fundData && (
        <View style={styles.previewCard}>
          <Text style={styles.fundName}>{fundData.meta.scheme_name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{fundData.meta.scheme_category}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Latest NAV</Text>
              <Text style={styles.metaValue}>{formatINR(Number(fundData.data[0]?.nav) || 0)}</Text>
            </View>
          </View>
          <Button
            label="Add to Portfolio (uses 100 units default)"
            variant="secondary"
            onPress={() => {
              onAddFund(fundData);
              setFundData(null);
              setCode("");
            }}
          />
        </View>
      )}
    </Animatable.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(12,35,64,0.14)",
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: "#1A1A1A", // Forced dark grey
    borderRadius: Radius.md,
    color: "#FFFFFF", // Forced pure white
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  error: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  previewCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  fundName: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
    marginBottom: 4,
  },
  metaValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
});
