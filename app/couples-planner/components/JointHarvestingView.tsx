import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";

import { Colors, Typography } from "../../../src/core/theme";
import { formatINR, JointOptimizationResult } from "../../../src/core/models/UserProfile";

interface JointHarvestingViewProps {
  optimization: JointOptimizationResult;
  userName: string;
  partnerName: string;
  onClose: () => void;
}

export default function JointHarvestingView({ 
  optimization, 
  userName, 
  partnerName,
  onClose 
}: JointHarvestingViewProps) {
  const { taxHarvesting } = optimization;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Joint Tax Harvesting</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Combined Tax-Free Gain Potential</Text>
          <Text style={styles.summaryValue}>{formatINR(taxHarvesting.totalTaxFreeGain)}</Text>
          <Text style={styles.summarySub}>Target: ₹2,50,000 (₹1.25L each)</Text>
        </View>

        <View style={styles.planSection}>
          <Text style={styles.sectionTitle}>Sell Strategy</Text>
          
          <Animatable.View animation="fadeInLeft" style={styles.planItem}>
            <View style={styles.planHeader}>
              <Text style={styles.personName}>{userName}</Text>
              <Text style={styles.amountText}>{formatINR(taxHarvesting.userSell)}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(taxHarvesting.userSell / 125000) * 100}%` }]} />
            </View>
            <Text style={styles.planSub}>Sell units with ₹{formatINR(taxHarvesting.userSell, true)} unrealized gain.</Text>
          </Animatable.View>

          <Animatable.View animation="fadeInRight" delay={200} style={styles.planItem}>
            <View style={styles.planHeader}>
              <Text style={styles.personName}>{partnerName}</Text>
              <Text style={styles.amountText}>{formatINR(taxHarvesting.partnerSell)}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(taxHarvesting.partnerSell / 125000) * 100}%`, backgroundColor: Colors.gold }]} />
            </View>
            <Text style={styles.planSub}>Sell units with ₹{formatINR(taxHarvesting.partnerSell, true)} unrealized gain.</Text>
          </Animatable.View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.purple} />
          <Text style={styles.infoText}>
            LTCG up to ₹1.25L per person is tax-free every year. Booking these gains and reinvesting immediately "resets" your cost basis and saves 12.5% tax in the future.
          </Text>
        </View>

        <Text style={styles.nextStepTitle}>Next Step</Text>
        <View style={styles.stepCard}>
          <MaterialCommunityIcons name="gesture-tap" size={24} color={Colors.gold} />
          <Text style={styles.stepText}>{taxHarvesting.nextStep}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
  },
  content: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: Colors.navy,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontFamily: Typography.fontFamily.display,
    color: Colors.teal,
    marginBottom: 4,
  },
  summarySub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.body,
    color: "#FFF",
    opacity: 0.7,
  },
  planSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  planItem: {
    marginBottom: 20,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  personName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: Colors.textPrimary,
  },
  amountText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.teal,
    borderRadius: 4,
  },
  planSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#F3F1FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: Colors.purple,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textPrimary,
    marginLeft: 10,
    lineHeight: 18,
  },
  nextStepTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 12,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textPrimary,
    marginLeft: 12,
    lineHeight: 18,
  },
});
