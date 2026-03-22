import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Radius, Spacing, Typography } from "../../../src/core/theme";
import { MFHolding } from "../../../src/core/models/UserProfile";

// ─── types ───────────────────────────────────────────────────────────────────

interface FetchedScheme {
  code:      string;
  name:      string;
  nav:       number;
  category:  MFHolding["category"];
  navDate:   string;
}

interface DraftHolding {
  scheme:        FetchedScheme;
  units:         string;
  purchaseNav:   string;
  purchaseDate:  string;   // YYYY-MM-DD
}

interface SchemeInputFormProps {
  onSubmit: (holdings: MFHolding[]) => void;
  onCancel: () => void;
  maxSchemes?: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const VALID_CODE = /^\d{6}$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCategory(raw: string): MFHolding["category"] {
  const s = raw.toLowerCase();
  if (s.includes("large cap") || s.includes("large-cap")) return "large_cap";
  if (s.includes("mid cap")   || s.includes("mid-cap"))   return "mid_cap";
  if (s.includes("small cap") || s.includes("small-cap")) return "small_cap";
  if (s.includes("elss"))                                  return "elss";
  if (s.includes("debt") || s.includes("bond") || s.includes("gilt")) return "debt";
  if (s.includes("hybrid") || s.includes("balanced") || s.includes("arbitrage")) return "hybrid";
  if (s.includes("liquid") || s.includes("overnight") || s.includes("money market")) return "liquid";
  return "other";
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function buildHolding(draft: DraftHolding): MFHolding {
  const units        = parseFloat(draft.units)        || 0;
  const purchaseNav  = parseFloat(draft.purchaseNav)  || draft.scheme.nav;
  const currentValue = units * draft.scheme.nav;
  const purchaseValue = units * purchaseNav;
  const purchaseDate  = VALID_DATE.test(draft.purchaseDate) ? draft.purchaseDate : todayString();

  // build cashflow for XIRR — one investment on purchase date, current value today
  const transactions = [
    { date: new Date(purchaseDate), amount: purchaseValue },
  ];

  return {
    id:            draft.scheme.code,
    name:          draft.scheme.name,
    category:      draft.scheme.category,
    units,
    nav:           draft.scheme.nav,
    currentValue,
    purchaseValue,
    purchaseDate,
    xirr:          null, // recalculated in buildXRay
    transactions,
  };
}

// ─── component ───────────────────────────────────────────────────────────────

export function SchemeInputForm({ onSubmit, onCancel, maxSchemes = 10 }: SchemeInputFormProps) {
  const [codeInput,    setCodeInput]    = useState("");
  const [fetching,     setFetching]     = useState(false);
  const [fetchError,   setFetchError]   = useState("");
  const [drafts,       setDrafts]       = useState<DraftHolding[]>([]);
  const [activeDraft,  setActiveDraft]  = useState<number | null>(null);

  // ── fetch scheme from MFAPI ────────────────────────────────────────────────

  const fetchScheme = useCallback(async () => {
    const code = codeInput.trim();
    if (!VALID_CODE.test(code)) {
      setFetchError("Enter a valid 6-digit AMFI scheme code.");
      return;
    }
    if (drafts.length >= maxSchemes) {
      setFetchError("Maximum " + maxSchemes + " schemes at a time.");
      return;
    }
    if (drafts.some((d) => d.scheme.code === code)) {
      setFetchError("This scheme is already added.");
      return;
    }

    try {
      setFetching(true);
      setFetchError("");

      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 6000);

      const res  = await fetch("https://api.mfapi.in/mf/" + code, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error("Scheme not found. Check the code and try again.");

      const json = await res.json();
      if (json.status !== "SUCCESS") throw new Error("Scheme not found.");

      const nav = parseFloat(json.data?.[0]?.nav ?? "0");

      const scheme: FetchedScheme = {
        code,
        name:     json.meta?.scheme_name ?? "Unknown Fund",
        nav,
        category: normalizeCategory(json.meta?.scheme_category ?? ""),
        navDate:  json.data?.[0]?.date ?? todayString(),
      };

      setDrafts((prev) => [
        ...prev,
        {
          scheme,
          units:        "",
          purchaseNav:  "",
          purchaseDate: "",
        },
      ]);
      setActiveDraft(drafts.length); // expand the new card
      setCodeInput("");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setFetchError("Request timed out. Check your connection.");
      } else {
        setFetchError(err instanceof Error ? err.message : "Failed to fetch scheme.");
      }
    } finally {
      setFetching(false);
    }
  }, [codeInput, drafts, maxSchemes]);

  // ── update a draft field ───────────────────────────────────────────────────

  function updateDraft(index: number, field: keyof Omit<DraftHolding, "scheme">, value: string) {
    setDrafts((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
    setActiveDraft(null);
  }

  // ── validate and submit ────────────────────────────────────────────────────

  function handleSubmit() {
    if (drafts.length === 0) {
      Alert.alert("No funds added", "Add at least one scheme before saving.");
      return;
    }

    const errors: string[] = [];
    drafts.forEach((d, i) => {
      const units = parseFloat(d.units);
      if (!d.units || isNaN(units) || units <= 0) {
        errors.push("Fund " + (i + 1) + " (" + d.scheme.name.split(" ").slice(0, 3).join(" ") + "): units required.");
      }
      if (d.purchaseDate && !VALID_DATE.test(d.purchaseDate)) {
        errors.push("Fund " + (i + 1) + ": purchase date must be YYYY-MM-DD format.");
      }
    });

    if (errors.length > 0) {
      Alert.alert("Fix these errors", errors.join("\n"));
      return;
    }

    // warn if any purchase date is missing — XIRR will be inaccurate
    const missingDates = drafts.filter((d) => !d.purchaseDate.trim());
    if (missingDates.length > 0) {
      Alert.alert(
        "Purchase date missing",
        missingDates.length + " fund(s) have no purchase date. XIRR will be inaccurate. Continue anyway?",
        [
          { text: "Go back", style: "cancel" },
          {
            text: "Continue",
            onPress: () => onSubmit(drafts.map(buildHolding)),
          },
        ]
      );
      return;
    }

    onSubmit(drafts.map(buildHolding));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add funds by scheme code</Text>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── scheme code lookup ── */}
        <View style={styles.lookupCard}>
          <Text style={styles.lookupTitle}>Find your scheme</Text>
          <Text style={styles.lookupBody}>
            Enter the 6-digit AMFI scheme code. Find it at amfiindia.com or on your fund's fact sheet.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.codeInput}
              value={codeInput}
              onChangeText={(v) => {
                setCodeInput(v.replace(/\D/g, "").slice(0, 6));
                setFetchError("");
              }}
              placeholder="e.g. 120503"
              placeholderTextColor={Colors.t3}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="search"
              onSubmitEditing={fetchScheme}
              editable={!fetching}
            />
            <TouchableOpacity
              style={[styles.fetchBtn, fetching ? styles.fetchBtnDisabled : null]}
              onPress={fetchScheme}
              disabled={fetching}
              activeOpacity={0.8}
            >
              {fetching
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={styles.fetchBtnText}>Fetch</Text>}
            </TouchableOpacity>
          </View>

          {fetchError ? <Text style={styles.fetchError}>{fetchError}</Text> : null}

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>How to find the scheme code</Text>
            <Text style={styles.tipBody}>
              {"1. Go to amfiindia.com → NAV History\n2. Search your fund name\n3. Copy the 6-digit code\n4. Paste it above"}
            </Text>
          </View>
        </View>

        {/* ── draft holding cards ── */}
        {drafts.length > 0 ? (
          <View style={styles.draftsSection}>
            <Text style={styles.draftsTitle}>
              {drafts.length + " fund" + (drafts.length !== 1 ? "s" : "") + " added"}
            </Text>

            {drafts.map((draft, i) => {
              const isOpen = activeDraft === i;

              return (
                <View key={draft.scheme.code} style={styles.draftCard}>

                  {/* ── card header — tap to expand ── */}
                  <TouchableOpacity
                    style={styles.draftHeader}
                    onPress={() => setActiveDraft(isOpen ? null : i)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.draftHeaderLeft}>
                      <Text style={styles.draftName} numberOfLines={2}>
                        {draft.scheme.name}
                      </Text>
                      <View style={styles.draftMetaRow}>
                        <View style={[styles.catBadge, { backgroundColor: Colors.s3 }]}>
                          <Text style={styles.catBadgeText}>{draft.scheme.category.replace(/_/g, " ")}</Text>
                        </View>
                        <Text style={styles.navText}>
                          {"NAV ₹" + draft.scheme.nav.toFixed(2) + " · " + draft.scheme.navDate}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.draftHeaderRight}>
                      {draft.units && parseFloat(draft.units) > 0 ? (
                        <View style={styles.doneTag}>
                          <Text style={styles.doneTagText}>✓</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingTag}>
                          <Text style={styles.pendingTagText}>Fill details</Text>
                        </View>
                      )}
                      <Text style={styles.chevron}>{isOpen ? "↑" : "↓"}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* ── expanded fields ── */}
                  {isOpen ? (
                    <View style={styles.draftFields}>

                      {/* units */}
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>
                          Units held
                          <Text style={styles.fieldRequired}> *</Text>
                        </Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={draft.units}
                          onChangeText={(v) => updateDraft(i, "units", v.replace(/[^0-9.]/g, ""))}
                          placeholder="e.g. 245.678"
                          placeholderTextColor={Colors.t3}
                          keyboardType="decimal-pad"
                        />
                        {draft.units && parseFloat(draft.units) > 0 ? (
                          <Text style={styles.fieldHint}>
                            {"Current value: ₹" + (parseFloat(draft.units) * draft.scheme.nav).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </Text>
                        ) : null}
                      </View>

                      {/* purchase date */}
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>
                          Purchase date
                          <Text style={styles.fieldRecommended}> (recommended for accurate XIRR)</Text>
                        </Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={draft.purchaseDate}
                          onChangeText={(v) => updateDraft(i, "purchaseDate", v)}
                          placeholder="YYYY-MM-DD  e.g. 2022-06-15"
                          placeholderTextColor={Colors.t3}
                          keyboardType="numbers-and-punctuation"
                          maxLength={10}
                        />
                        <Text style={styles.fieldHint}>
                          When you first purchased this fund. Without this, XIRR cannot be calculated accurately.
                        </Text>
                      </View>

                      {/* purchase NAV */}
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>
                          Purchase NAV
                          <Text style={styles.fieldRecommended}> (optional but improves accuracy)</Text>
                        </Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={draft.purchaseNav}
                          onChangeText={(v) => updateDraft(i, "purchaseNav", v.replace(/[^0-9.]/g, ""))}
                          placeholder={"Current NAV is ₹" + draft.scheme.nav.toFixed(2) + " — enter if different"}
                          placeholderTextColor={Colors.t3}
                          keyboardType="decimal-pad"
                        />
                        {draft.units && draft.purchaseNav && parseFloat(draft.units) > 0 && parseFloat(draft.purchaseNav) > 0 ? (
                          <Text style={styles.fieldHint}>
                            {"Purchase value: ₹" + (parseFloat(draft.units) * parseFloat(draft.purchaseNav)).toLocaleString("en-IN", { maximumFractionDigits: 0 }) +
                              " · Gain: " + (((draft.scheme.nav / parseFloat(draft.purchaseNav)) - 1) * 100).toFixed(1) + "%"}
                          </Text>
                        ) : null}
                      </View>

                      {/* remove button */}
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeDraft(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeBtnText}>Remove this fund</Text>
                      </TouchableOpacity>

                    </View>
                  ) : null}

                </View>
              );
            })}
          </View>
        ) : null}

      </ScrollView>

      {/* ── bottom action bar ── */}
      <View style={styles.footer}>
        {drafts.length > 0 ? (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>
              {"Save " + drafts.length + " fund" + (drafts.length !== 1 ? "s" : "") + " to portfolio"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.cancelFooterBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelFooterText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.bg,
  },

  // ── header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop:      Spacing["2xl"],
    paddingBottom:   Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.b0,
  },
  headerTitle: {
    color:      Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.lg,
  },
  cancelBtn: {
    padding: Spacing.sm,
  },
  cancelText: {
    color:      Colors.t2,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.sm,
  },

  // ── scroll ─────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    padding:      Spacing.lg,
    paddingBottom: 100,
    gap:          Spacing.lg,
  },

  // ── lookup card ────────────────────────────────────────────────────────────
  lookupCard: {
    backgroundColor: Colors.s1,
    borderColor:     Colors.b1,
    borderRadius:    Radius.lg,
    borderWidth:     0.5,
    padding:         Spacing.lg,
    gap:             Spacing.md,
  },
  lookupTitle: {
    color:      Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.md,
  },
  lookupBody: {
    color:      Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize:   Typography.size.xs,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    gap:           Spacing.sm,
  },
  codeInput: {
    flex:              1,
    backgroundColor:   Colors.s2,
    borderColor:       Colors.b1,
    borderRadius:      Radius.md,
    borderWidth:       0.5,
    color:             Colors.t0,
    fontFamily:        Typography.fontFamily.numeric,
    fontSize:          Typography.size.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    letterSpacing:     1,
  },
  fetchBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    Radius.md,
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: Spacing.lg,
  },
  fetchBtnDisabled: { opacity: 0.6 },
  fetchBtnText: {
    color:      Colors.bg,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.sm,
  },
  fetchError: {
    color:      Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.xs,
  },
  tipBox: {
    backgroundColor: Colors.s2,
    borderColor:     Colors.b0,
    borderRadius:    Radius.md,
    borderWidth:     0.5,
    padding:         Spacing.md,
    gap:             Spacing.xs,
  },
  tipTitle: {
    color:      Colors.t1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.xs,
  },
  tipBody: {
    color:      Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize:   Typography.size.xs,
    lineHeight: 19,
  },

  // ── drafts ─────────────────────────────────────────────────────────────────
  draftsSection: { gap: Spacing.sm },
  draftsTitle: {
    color:         Colors.t2,
    fontFamily:    Typography.fontFamily.bodyMedium,
    fontSize:      Typography.size.xs,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginBottom:  Spacing.xs,
  },
  draftCard: {
    backgroundColor: Colors.s1,
    borderColor:     Colors.b1,
    borderRadius:    Radius.lg,
    borderWidth:     0.5,
    overflow:        "hidden",
  },
  draftHeader: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    justifyContent: "space-between",
    padding:        Spacing.md,
    gap:            Spacing.sm,
  },
  draftHeaderLeft: { flex: 1 },
  draftName: {
    color:        Colors.t0,
    fontFamily:   Typography.fontFamily.bodyMedium,
    fontSize:     Typography.size.sm,
    lineHeight:   20,
    marginBottom: Spacing.xs,
  },
  draftMetaRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           Spacing.sm,
    flexWrap:      "wrap",
  },
  catBadge: {
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
  },
  catBadgeText: {
    color:         Colors.t1,
    fontFamily:    Typography.fontFamily.bodyMedium,
    fontSize:      10,
    textTransform: "capitalize",
  },
  navText: {
    color:      Colors.t2,
    fontFamily: Typography.fontFamily.numeric,
    fontSize:   10,
  },
  draftHeaderRight: {
    alignItems:  "center",
    gap:         Spacing.xs,
    flexShrink:  0,
  },
  doneTag: {
    backgroundColor: Colors.tealDim,
    borderRadius:    Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  2,
  },
  doneTagText: {
    color:      Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   10,
  },
  pendingTag: {
    backgroundColor: Colors.amberDim,
    borderRadius:    Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  2,
  },
  pendingTagText: {
    color:      Colors.amber,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   10,
  },
  chevron: {
    color:      Colors.t2,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   12,
  },

  // ── fields ─────────────────────────────────────────────────────────────────
  draftFields: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.b0,
    padding:        Spacing.md,
    gap:            Spacing.lg,
  },
  fieldGroup: { gap: Spacing.sm },
  fieldLabel: {
    color:      Colors.t1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.xs,
  },
  fieldRequired: { color: Colors.red },
  fieldRecommended: {
    color:      Colors.t3,
    fontFamily: Typography.fontFamily.body,
    fontSize:   10,
  },
  fieldInput: {
    backgroundColor:   Colors.s2,
    borderColor:       Colors.b1,
    borderRadius:      Radius.md,
    borderWidth:       0.5,
    color:             Colors.t0,
    fontFamily:        Typography.fontFamily.body,
    fontSize:          Typography.size.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
  },
  fieldHint: {
    color:      Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize:   10,
    lineHeight: 16,
  },
  removeBtn: {
    alignItems:      "center",
    borderColor:     Colors.redDim,
    borderRadius:    Radius.full,
    borderWidth:     0.5,
    paddingVertical: 8,
    marginTop:       Spacing.xs,
  },
  removeBtnText: {
    color:      Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.xs,
  },

  // ── footer ─────────────────────────────────────────────────────────────────
  footer: {
    borderTopWidth:    0.5,
    borderTopColor:    Colors.b0,
    padding:           Spacing.lg,
    paddingBottom:     Spacing["2xl"],
    backgroundColor:   Colors.bg,
  },
  submitBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    Radius.full,
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 14,
  },
  submitBtnText: {
    color:      Colors.bg,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.md,
  },
  cancelFooterBtn: {
    backgroundColor: Colors.s2,
    borderColor:     Colors.b1,
    borderRadius:    Radius.full,
    borderWidth:     0.5,
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 14,
  },
  cancelFooterText: {
    color:      Colors.t1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize:   Typography.size.md,
  },
});