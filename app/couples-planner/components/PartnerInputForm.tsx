import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Animatable from "react-native-animatable";

import { Colors, Typography } from "../../../src/core/theme";
import { PartnerProfileData, JointHomeLoan, JointPortfolioSummary } from "../../../src/core/models/UserProfile";

interface PartnerInputFormProps {
  onSave: (data: { partner: PartnerProfileData; homeLoan: JointHomeLoan; portfolio: JointPortfolioSummary }) => void;
  onCancel: () => void;
  initialName?: string;
}

export default function PartnerInputForm({ onSave, onCancel, initialName }: PartnerInputFormProps) {
  const [partner, setPartner] = useState<PartnerProfileData>({
    name: initialName || "",
    age: 30,
    monthlyIncome: 0,
    annualIncome: 0,
    basicSalary: 0,
    annualPF: 0,
    annual80C: 0,
    annualNPS: 0,
    annualHRA: 0,
    existingCorpus: 0,
    monthlySIP: 0,
    termInsuranceCover: 0,
    healthInsuranceCover: 0,
  });

  const [homeLoan, setHomeLoan] = useState<JointHomeLoan>({
    active: false,
    totalPrincipalOutstandig: 0,
    monthlyEMI: 0,
    annualInterest: 0,
    annualPrincipal: 0,
  });

  const [portfolio, setPortfolio] = useState<JointPortfolioSummary>({
    combinedCorpus: 0,
    combinedSIP: 0,
    userLTCG: 0,
    partnerLTCG: 0,
  });

  const updatePartner = (key: keyof PartnerProfileData, value: string | number) => {
    let num: number;
    
    if (typeof value === "string") {
      // Allow decimal points in numeric input
      num = parseFloat(value.replace(/[^0-9.]/g, ""));
    } else {
      num = value;
    }

    // Ensure non-negative values
    if (isNaN(num) || num < 0) {
      num = 0;
    }

    const newPartner = { ...partner, [key]: num };
    
    // Auto-calculate annual if monthly changes
    if (key === "monthlyIncome") {
      newPartner.annualIncome = (num as number) * 12;
      newPartner.basicSalary = Math.round(newPartner.annualIncome * 0.4);
    }
    
    setPartner(newPartner);
  };

  const updateLoan = (key: keyof JointHomeLoan, value: string | number | boolean) => {
    if (typeof value === "boolean") {
      setHomeLoan({ ...homeLoan, [key]: value });
      return;
    }

    let val: number;
    if (typeof value === "string") {
      val = parseFloat(value.replace(/[^0-9.]/g, ""));
      if (isNaN(val) || val < 0) {
        val = 0;
      }
    } else {
      val = value < 0 ? 0 : value;
    }

    setHomeLoan({ ...homeLoan, [key]: val });
  };

  const handleSave = () => {
    if (!partner.name) {
      alert("Please enter partner's name.");
      return;
    }
    onSave({ partner, homeLoan, portfolio });
  };

  const renderSection = (title: string, icon: any) => (
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon} size={20} color={Colors.gold} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderInput = (label: string, value: number | string, onChange: (val: string) => void, placeholder = "0") => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value.toString()}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Partner Details</Text>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderSection("Basic Info", "person")}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Partner's Name</Text>
          <TextInput
            style={styles.input}
            value={partner.name}
            onChangeText={(val) => setPartner({ ...partner, name: val })}
            placeholder="e.g. Priya"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        {renderInput("Monthly Income (\u20B9)", partner.monthlyIncome || "", (val) => updatePartner("monthlyIncome", val))}

        {renderSection("Tax Buckets (Annual)", "account-balance-wallet")}
        {renderInput("Annual PF (\u20B9)", partner.annualPF || "", (val) => updatePartner("annualPF", val))}
        {renderInput("Other 80C (\u20B9)", partner.annual80C || "", (val) => updatePartner("annual80C", val))}
        {renderInput("Annual HRA Allowance (\u20B9)", partner.annualHRA || "", (val) => updatePartner("annualHRA", val))}
        {renderInput("Annual NPS Contribution (\u20B9)", partner.annualNPS || "", (val) => updatePartner("annualNPS", val))}

        {renderSection("Investments", "trending-up")}
        {renderInput("Existing Corpus (\u20B9)", partner.existingCorpus || "", (val) => updatePartner("existingCorpus", val))}
        {renderInput("Monthly SIP (\u20B9)", partner.monthlySIP || "", (val) => updatePartner("monthlySIP", val))}
        {renderInput("Unrealized LTCG (\u20B9)", portfolio.partnerLTCG || "", (val) => setPortfolio({ ...portfolio, partnerLTCG: Number(val) }))}

        {renderSection("Joint Home Loan", "home")}
        <TouchableOpacity 
          style={styles.checkboxRow} 
          onPress={() => updateLoan("active", !homeLoan.active)}
        >
          <Ionicons 
            name={homeLoan.active ? "checkbox" : "square-outline"} 
            size={24} 
            color={homeLoan.active ? Colors.teal : Colors.textMuted} 
          />
          <Text style={styles.checkboxLabel}>Is there a joint home loan?</Text>
        </TouchableOpacity>

        {homeLoan.active && (
          <Animatable.View animation="fadeIn">
            {renderInput("Annual Interest Paid (\u20B9)", homeLoan.annualInterest || "", (val) => updateLoan("annualInterest", val))}
            {renderInput("Principal Outstanding (\u20B9)", homeLoan.totalPrincipalOutstandig || "", (val) => updateLoan("totalPrincipalOutstandig", val))}
          </Animatable.View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Analyze Joint Future</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.card,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
  },
  scrollContent: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginLeft: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    height: 52,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textPrimary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textPrimary,
    marginLeft: 10,
  },
  spacer: {
    height: 40,
  },
  footer: {
    padding: 20,
    borderTopWidth: 0.5,
    borderColor: Colors.border,
    paddingBottom: 40,
  },
  saveButton: {
    backgroundColor: Colors.gold,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
  },
});
