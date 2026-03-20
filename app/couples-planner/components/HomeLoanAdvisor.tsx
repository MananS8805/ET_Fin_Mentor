import { Ionicons, MaterialIcons } from "@expo/vector-icons";
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

interface HomeLoanAdvisorProps {
  optimization: JointOptimizationResult;
  userName: string;
  partnerName: string;
  onClose: () => void;
}

export default function HomeLoanAdvisor({ 
  optimization, 
  userName, 
  partnerName,
  onClose 
}: HomeLoanAdvisorProps) {
  const { homeLoanAdvice } = optimization;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home Loan Advisor</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.benefitCard}>
          <Text style={styles.benefitLabel}>Estimated Annual Tax Saving</Text>
          <Text style={styles.benefitValue}>{formatINR(homeLoanAdvice.estimatedTaxBenefit)}</Text>
          <Text style={styles.benefitSub}>via optimal joint interest claiming</Text>
        </View>

        <View style={styles.strategySection}>
          <Text style={styles.sectionTitle}>Optimization Splits</Text>
          
          <Animatable.View animation="fadeInUp" style={styles.strategyItem}>
            <View style={styles.strategyIcon}>
              <MaterialIcons name="trending-down" size={24} color={Colors.teal} />
            </View>
            <View style={styles.strategyText}>
              <Text style={styles.strategyLabel}>Interest (Sec 24b)</Text>
              <Text style={styles.strategyValue}>
                Claim mostly by <Text style={styles.highlight}>{homeLoanAdvice.optimalInterestClaimer === "user" ? userName : partnerName}</Text>
              </Text>
              <Text style={styles.strategyDesc}>
                This partner is in a higher tax bracket, maximizing the ₹2L interest deduction.
              </Text>
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={200} style={styles.strategyItem}>
            <View style={styles.strategyIcon}>
              <MaterialIcons name="pie-chart" size={24} color={Colors.gold} />
            </View>
            <View style={styles.strategyText}>
              <Text style={styles.strategyLabel}>Principal (Sec 80C)</Text>
              <Text style={styles.strategyValue}>
                <Text style={styles.highlight}>Split</Text> between both
              </Text>
              <Text style={styles.strategyDesc}>
                Both partners can use the ₹1.5L 80C limit (total ₹3L) if both are co-borrowers and co-owners.
              </Text>
            </View>
          </Animatable.View>
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="bulb" size={20} color={Colors.gold} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Pro Tip for Couples</Text>
            <Text style={styles.tipText}>
              To claim tax benefits as co-borrowers, both partners MUST be co-owners in the property deed. Just paying the EMI is not enough.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.ctaButton} onPress={onClose}>
          <Text style={styles.ctaText}>Got it, Thanks!</Text>
        </TouchableOpacity>
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
  benefitCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  benefitLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  benefitValue: {
    fontSize: 32,
    fontFamily: Typography.fontFamily.display,
    color: Colors.teal,
    marginBottom: 4,
  },
  benefitSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
  },
  strategySection: {
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
  strategyItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  strategyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  strategyText: {
    flex: 1,
  },
  strategyLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  strategyValue: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 4,
  },
  highlight: {
    color: Colors.gold,
  },
  strategyDesc: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  tipBox: {
    flexDirection: "row",
    backgroundColor: "#FFFAF0",
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 0.5,
    borderColor: Colors.gold,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  ctaButton: {
    backgroundColor: Colors.navy,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: "#FFF",
  },
});
