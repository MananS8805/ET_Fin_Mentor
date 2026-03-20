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

import { Colors, Typography } from "../../src/core/theme";
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

export default function CouplesPlannerScreen() {
  const router = useRouter();
  const { currentProfile, jointProfile, setJointProfile } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [optimization, setOptimization] = useState<JointOptimizationResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState<"harvesting" | "homeloan" | null>(null);

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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Couple's Planner</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.badgeText}>BETA</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!jointProfile ? (
          <Animatable.View animation="fadeInUp" style={styles.emptyState}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="account-group" size={48} color={Colors.gold} />
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
                  <Ionicons name="checkmark-circle" size={20} color={Colors.teal} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddPartner}>
              <Text style={styles.buttonText}>Add Partner Details</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.navy} />
            </TouchableOpacity>
          </Animatable.View>
        ) : (
          <View>
            {/* Joint Dashboard will be implemented here */}
            <Text style={styles.sectionTitle}>Joint Strategy</Text>
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
              <View style={styles.grid}>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreLabel}>Combined Net Worth</Text>
                  <Text style={styles.scoreValue}>{formatINR(optimization.combinedNetWorth, true)}</Text>
                </View>
                
                <TouchableOpacity style={styles.optCard}>
                  <Text style={styles.optTitle}>HRA Optimization</Text>
                  <Text style={styles.optHighlight}>{optimization.hraSuggestion.recommendedClaimer.toUpperCase()} claims</Text>
                  <Text style={styles.optSub}>Save {formatINR(optimization.hraSuggestion.estimatedSaving)}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optCard} onPress={() => setActiveView("harvesting")}>
                  <Text style={styles.optTitle}>Tax Harvesting</Text>
                  <Text style={styles.optHighlight}>{formatINR(optimization.taxHarvesting.totalTaxFreeGain, true)}</Text>
                  <Text style={styles.optSub}>Tax-free gains this year</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optCard} onPress={() => setActiveView("homeloan")}>
                  <Text style={styles.optTitle}>Home Loan</Text>
                  <Text style={styles.optHighlight}>Save {formatINR(optimization.homeLoanAdvice.estimatedTaxBenefit, true)}</Text>
                  <Text style={styles.optSub}>via optimal co-borrowing</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: Colors.navy,
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
    color: "#FFF",
  },
  headerBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.body,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  primaryButton: {
    backgroundColor: Colors.gold,
    height: 52,
    borderRadius: 12,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 15,
  },
  aiCard: {
    backgroundColor: "#F3F1FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.purple,
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
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  scoreCard: {
    width: "100%",
    backgroundColor: Colors.navy,
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textMuted,
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 32,
    fontFamily: Typography.fontFamily.display,
    color: Colors.gold,
  },
  optCard: {
    width: "48%",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 0.5,
    borderColor: Colors.border,
    elevation: 2,
  },
  optTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  optHighlight: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.display,
    color: Colors.navy,
    marginBottom: 4,
  },
  optSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.body,
    color: Colors.teal,
  },
});
