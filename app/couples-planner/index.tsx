import { 
  Ionicons, 
  MaterialCommunityIcons 
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import * as Animatable from "react-native-animatable";
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";
import { useAppStore } from "../../src/core/services/store";
import { 
  JointProfileData, 
  calculateJointOptimization, 
  formatINR, 
  JointOptimizationResult 
} from "../../src/core/models/UserProfile";
import { TemplateService } from "../../src/core/services/TemplateService";
import PartnerInputForm from "./components/PartnerInputForm";
import JointHarvestingView from "./components/JointHarvestingView";
import HomeLoanAdvisor from "./components/HomeLoanAdvisor";

function AnimatedNetWorth({ value }: { value: number }) {
  const progress = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, value]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (next, prev) => {
      if (next !== prev) {
        runOnJS(setDisplayValue)(next);
      }
    },
    [progress]
  );

  return <Text style={styles.scoreValue}>{formatINR(displayValue, true)}</Text>;
}

export default function CouplesPlannerScreen() {
  const router = useRouter();
  const currentProfile = useAppStore((state) => state.currentProfile);
  const jointProfile = useAppStore((state) => state.jointProfile);
  const setJointProfile = useAppStore((state) => state.setJointProfile);
  const [loading, setLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [optimization, setOptimization] = useState<JointOptimizationResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState<"harvesting" | "homeloan" | null>(null);
  const emptyY = useSharedValue(30);
  const emptyOpacity = useSharedValue(0);

  useEffect(() => {
    emptyY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    emptyOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [emptyOpacity, emptyY]);

  const emptyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: emptyOpacity.value,
    transform: [{ translateY: emptyY.value }],
  }));

  useEffect(() => {
    if (jointProfile) {
      const result = calculateJointOptimization(jointProfile);
      setOptimization(result);
      fetchAiAdvice(jointProfile, result);
    }
  }, [jointProfile]);

  const fetchAiAdvice = async (data: JointProfileData, result: JointOptimizationResult) => {
    try {
      setLoading(true);
      // Brief simulated delay for UX
      await new Promise(resolve => setTimeout(resolve, 600));
      const advice = TemplateService.getJointOptimizationAdvice(data, result);
      setAiAdvice(advice);
    } catch (error) {
      console.error("[CouplesPlanner] Advice error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = () => {
    setShowForm(true);
  };

  const handleSaveJointData = (data: { partner: any; homeLoan: any; portfolio: any }) => {
    if (!currentProfile) return;

    const newJointProfile: JointProfileData = {
      user: currentProfile,
      partner: data.partner,
      homeLoan: data.homeLoan,
      portfolio: {
        ...data.portfolio,
        combinedCorpus: currentProfile.existingCorpus + data.partner.existingCorpus,
        combinedSIP: currentProfile.monthlySIP + data.partner.monthlySIP,
        userLTCG: 0, 
      }
    };
    setJointProfile(newJointProfile);
    setShowForm(false);
  };

  if (!currentProfile) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.t0} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Couple's Planner</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.badgeText}>BETA</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!jointProfile ? (
          <Animated.View style={[styles.emptyState, emptyAnimatedStyle]}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>👫</Text>
            </View>
            <Text style={styles.emptyTitle}>Better Together</Text>
            <Text style={styles.emptySubtitle}>
              India's first AI-powered joint financial planning tool. Both partners input data. AI optimizes everything.
            </Text>
            
            <View style={styles.featureList}>
              {[
                "Optimize HRA & NPS across incomes",
                "Joint vs Individual insurance audit",
                "Shared SIP splits for max tax-saving",
                "Combined Net Worth & FIRE goal",
                "Joint Tax-Loss Harvesting plan",
                "Home Loan co-borrower advisor"
              ].map((feature, i) => (
                <View key={i} style={styles.featureItem}>
                  <View style={styles.featureTickCircle}>
                    <Text style={styles.featureTick}>✓</Text>
                  </View>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddPartner}>
              <Text style={styles.buttonText}>Add Partner Details</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.navy} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
  <View style={{ gap: Spacing.lg }}>
    <Text style={styles.sectionTitle}>Joint Strategy</Text>

    {/* AI Insights */}
    {loading ? (
      <ActivityIndicator color={Colors.purple} style={{ marginVertical: 20 }} />
    ) : aiAdvice ? (
      <Animatable.View animation="fadeIn" style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <MaterialCommunityIcons name="robot" size={20} color={Colors.purple} />
          <Text style={styles.aiLabel}>AI INSIGHTS</Text>
        </View>
        <Text style={styles.aiText}>{aiAdvice}</Text>
      </Animatable.View>
    ) : null}

    {optimization && (
      <>
        {/* Combined Net Worth */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Combined Net Worth</Text>
          <AnimatedNetWorth value={optimization.combinedNetWorth} />
        </View>

        {/* 2x2 Action Grid */}
        <View style={styles.grid}>
          {/* HRA — now has onPress */}
          <TouchableOpacity
            style={styles.optCard}
            onPress={() => Alert.alert(
              "HRA Optimization",
              `${optimization.hraSuggestion.recommendedClaimer === "user"
                ? currentProfile.name
                : jointProfile?.partner?.name ?? "Partner"} should claim HRA to save ${formatINR(optimization.hraSuggestion.estimatedSaving)}.\n\n${optimization.hraSuggestion.reason}`
            )}
          >
            <Text style={styles.optTitle}>HRA Optimization</Text>
            <Text style={styles.optHighlight}>
              {optimization.hraSuggestion.recommendedClaimer === "none"
                ? "No HRA data"
                : `${optimization.hraSuggestion.recommendedClaimer.toUpperCase()} claims`}
            </Text>
            <Text style={styles.optSub}>
              {optimization.hraSuggestion.estimatedSaving > 0
                ? `Save ${formatINR(optimization.hraSuggestion.estimatedSaving)}`
                : "Enter HRA data to optimize"}
            </Text>
          </TouchableOpacity>

          {/* Tax Harvesting */}
          <TouchableOpacity style={styles.optCard} onPress={() => setActiveView("harvesting")}>
            <Text style={styles.optTitle}>Tax Harvesting</Text>
            <Text style={styles.optHighlight}>{formatINR(optimization.taxHarvesting.totalTaxFreeGain, true)}</Text>
            <Text style={styles.optSub}>Tax-free gains this year</Text>
          </TouchableOpacity>

          {/* Home Loan */}
          <TouchableOpacity style={styles.optCard} onPress={() => setActiveView("homeloan")}>
            <Text style={styles.optTitle}>Home Loan</Text>
            <Text style={styles.optHighlight}>
              {optimization.homeLoanAdvice.estimatedTaxBenefit > 0
                ? `Save ${formatINR(optimization.homeLoanAdvice.estimatedTaxBenefit, true)}`
                : "No joint loan"}
            </Text>
            <Text style={styles.optSub}>via optimal co-borrowing</Text>
          </TouchableOpacity>

          {/* NPS Strategy — was completely missing */}
          <TouchableOpacity
            style={styles.optCard}
            onPress={() => Alert.alert(
              "NPS Strategy",
              optimization.npsStrategy.message
            )}
          >
            <Text style={styles.optTitle}>NPS Strategy</Text>
            <Text style={styles.optHighlight}>
              {formatINR(
                optimization.npsStrategy.userContribution +
                optimization.npsStrategy.partnerContribution,
                true
              )}
            </Text>
            <Text style={styles.optSub}>combined NPS contribution</Text>
          </TouchableOpacity>
        </View>

        {/* SIP Splits — was completely missing */}
        <View style={styles.sipCard}>
          <Text style={styles.sipTitle}>SIP Split Strategy</Text>
          <Text style={styles.sipReason}>{optimization.sipSplits.reason}</Text>
          <View style={styles.sipRow}>
            <View style={styles.sipCol}>
              <Text style={styles.sipName}>{currentProfile.name}</Text>
              <Text style={styles.sipAmount}>{formatINR(optimization.sipSplits.userSIP)}/mo</Text>
            </View>
            <View style={styles.sipDivider} />
            <View style={styles.sipCol}>
              <Text style={styles.sipName}>{jointProfile?.partner?.name ?? "Partner"}</Text>
              <Text style={styles.sipAmount}>{formatINR(optimization.sipSplits.partnerSIP)}/mo</Text>
            </View>
          </View>
        </View>

        {/* Insurance Advice — was completely missing */}
        <View style={styles.insuranceCard}>
          <Text style={styles.insuranceTitle}>Insurance Advice</Text>
          <Text style={styles.insuranceType}>
            Recommended: {optimization.insuranceAdvice.type === "joint-floater"
              ? "Joint Family Floater"
              : "Individual Plans"}
          </Text>
          <Text style={styles.insuranceReason}>{optimization.insuranceAdvice.reason}</Text>
          <Text style={styles.insuranceAction}>{optimization.insuranceAdvice.action}</Text>
        </View>

        {/* Edit partner data */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.editButtonText}>Edit Partner Details</Text>
        </TouchableOpacity>
      </>
    )}
  </View>
)}
      </ScrollView>

      <Modal visible={showForm} animationType="slide">
        <PartnerInputForm 
          onSave={handleSaveJointData} 
          onCancel={() => setShowForm(false)} 
        />
      </Modal>

      <Modal visible={activeView !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {activeView === "harvesting" && optimization && (
              <JointHarvestingView 
                optimization={optimization}
                userName={currentProfile.name}
                partnerName={jointProfile?.partner?.name ?? "Partner"}
                onClose={() => setActiveView(null)}
              />
            )}
            {activeView === "homeloan" && optimization && (
              <HomeLoanAdvisor 
                optimization={optimization}
                userName={currentProfile.name}
                partnerName={jointProfile?.partner?.name ?? "Partner"}
                onClose={() => setActiveView(null)}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    maxHeight: "85%",
  },
  header: {
    backgroundColor: Colors.bg,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: Typography.fontFamily.display,
    color: Colors.t0,
  },
  headerBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 24,
    borderWidth: 0.5,
    borderColor: "transparent",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(212,175,55,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.display,
    color: Colors.t0,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.body,
    color: Colors.t1,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  featureList: {
    width: "100%",
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: "rgba(255,255,255,0.8)",
    marginLeft: 12,
  },
  featureTickCircle: {
    alignItems: "center",
    backgroundColor: Colors.tealDim,
    borderRadius: Radius.full,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  featureTick: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 11,
    marginTop: -1,
  },
  primaryButton: {
    backgroundColor: Colors.gold,
    height: 52,
    borderRadius: Radius.full,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: Colors.bg,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.display,
    color: Colors.t0,
    marginBottom: 15,
  },
  aiCard: {
    backgroundColor: Colors.purpleDim,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: "rgba(133,114,224,0.20)",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  aiLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.display,
    color: Colors.purple,
    marginLeft: 8,
    letterSpacing: 1,
  },
  aiText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.body,
    color: Colors.t1,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  scoreCard: {
    width: "100%",
    backgroundColor: Colors.s1,
    padding: 20,
    borderWidth: 0.5,
    borderColor: Colors.b1,
    borderRadius: 24,
    marginBottom: 15,
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.t2,
    marginBottom: Spacing.xs,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  scoreValue: {
    fontSize: 34,
    fontFamily: Typography.fontFamily.numeric,
    color: Colors.gold,
  },
  optCard: {
    width: "48%",
    backgroundColor: Colors.s1,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.b0,
  },
  optTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.t2,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  optHighlight: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.numeric,
    color: Colors.t0,
    marginBottom: Spacing.xs,
  },
  optSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.body,
    color: Colors.teal,
  },
  sipCard: {
    backgroundColor: Colors.s1,
  borderRadius: Radius.lg,
  padding: Spacing.xl,
  borderWidth: 0.5,
    borderColor: Colors.b1,
  gap: Spacing.md,
},
sipTitle: {
  fontSize: 16,
  fontFamily: Typography.fontFamily.display,
    color: Colors.t0,
},
sipReason: {
  fontSize: 13,
  fontFamily: Typography.fontFamily.body,
    color: Colors.t1,
  lineHeight: 20,
},
sipRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 4,
},
sipCol: {
  flex: 1,
  alignItems: "center",
  gap: 4,
},
sipDivider: {
  width: 0.5,
  height: 40,
  backgroundColor: Colors.b1,
},
sipName: {
  fontSize: 13,
  fontFamily: Typography.fontFamily.bodyMedium,
  color: Colors.t2,
},
sipAmount: {
  fontSize: 18,
  fontFamily: Typography.fontFamily.numeric,
  color: Colors.t0,
},
insuranceCard: {
  backgroundColor: Colors.tealDim,
  borderRadius: 16,
  padding: 20,
  borderWidth: 0.5,
  borderColor: "rgba(31,190,114,0.20)",
  gap: 8,
},
insuranceTitle: {
  fontSize: 14,
  fontFamily: Typography.fontFamily.display,
  color: Colors.t2,
  textTransform: "uppercase",
  letterSpacing: 1,
},
insuranceType: {
  fontSize: 18,
  fontFamily: Typography.fontFamily.bodyMedium,
  color: Colors.t0,
},
insuranceReason: {
  fontSize: 13,
  fontFamily: Typography.fontFamily.body,
  color: Colors.t1,
  lineHeight: 20,
},
insuranceAction: {
  fontSize: 13,
  fontFamily: Typography.fontFamily.bodyMedium,
  color: Colors.teal,
  lineHeight: 20,
},
editButton: {
  backgroundColor: Colors.surface,
  borderRadius: 12,
  borderWidth: 0.5,
  borderColor: Colors.border,
  height: 48,
  alignItems: "center",
  justifyContent: "center",
},
editButtonText: {
  fontSize: 14,
  fontFamily: Typography.fontFamily.display,
  color: Colors.textPrimary,
},
});
