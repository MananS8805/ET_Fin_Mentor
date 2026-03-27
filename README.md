# ET FinMentor — AI-Powered Personal Finance Mentor

> **Hackathon submission for ET Hackathon 2026**
> Built for the problem statement: *"95% of Indians don't have a financial plan. Make financial planning as accessible as checking WhatsApp."*

---
![dashboard](asset/images/dashnoard_profile.jpeg)
![modules](asset/images/modules.jpeg)
![portfolio-xray](asset/images/portfolio-xray.jpeg)
![fire planner](asset/images/Fire.jpeg)


## What It Does

ET FinMentor is a full-stack AI financial advisor built as a React Native mobile app. It covers all 6 problem statement requirements:

| Feature | What it does |
|---|---|
| 🔥 **FIRE Planner** | Month-by-month roadmap: SIP amounts, corpus projection, asset allocation schedule, AI 12-month action plan |
| 💯 **Money Health Score** | 6-dimension wellness score: emergency, insurance, investment, debt, tax, retirement — calculated offline |
| 🎯 **Life Event Advisor** | Bonus, marriage, baby, inheritance, job switch, home purchase — AI advice personalized to your tax bracket |
| 🧾 **Tax Wizard** | Form 16 upload via Gemini Vision, old vs new regime comparison, ranked 80C/NPS/HRA recommendations |
| 👫 **Couple's Planner** | Joint HRA optimization, combined LTCG harvesting, SIP splits, insurance advice across both PAN cards |
| 🔬 **Portfolio X-Ray** | CAMS/KFintech upload → true XIRR, overlap detection, expense drag, AI rebalancing plan in <10 seconds |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Expo Go app on Android or iOS

### Setup

```bash
git clone https://github.com/your-org/et-finmentor
cd et-finmentor
npm install
cp .env.example .env
# Add your API keys to .env (see below)
npx expo start --android
```

### Required Environment Variables

```env
# Supabase (for auth + profile sync)
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx

# Gemini (AI features, CAMS parsing, Form16)
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyxxx

# Groq (automatic fallback when Gemini rate-limits)
EXPO_PUBLIC_GROQ_API_KEY=gsk_xxx
```

> **Note:** Groq is optional but strongly recommended. When Gemini hits a 429, the app automatically switches to Groq's llama-3.1-8b model with zero user impact.

### Demo Mode (No Keys Required)

**Tap the FM logo 5 times quickly on the splash screen** to activate demo mode with Rohan's pre-loaded profile (₹82K/month income, moderate risk, retirement at 55). All AI features work with the API keys — the demo profile provides realistic data without needing Supabase auth.

Three demo personas are available via Profile → Demo Controls:
- **Rohan** (28, ₹82K, moderate) — early career
- **Priya** (35, ₹1.4L, aggressive) — growth phase  
- **Vikram** (45, ₹2.1L, conservative) — pre-retirement

---

## Architecture

```
User (React Native / Expo Go)
    │
    ├── Supabase Auth (OTP phone/email) + expo-secure-store (local profile)
    │
    └── GeminiService / AI Router
            ├── Gemini 2.0 Flash (primary — text + Vision)
            ├── Groq llama-3.1-8b (automatic fallback on 429/404)
            └── TemplateService (offline fallback — app never breaks)
                    │
                    ├── FIRE Planner (SIP math, XIRR, projections — 100% local)
                    ├── Tax Wizard (slab calculations — 100% local)
                    ├── Health Score (6-dim scoring — 100% local)
                    ├── Portfolio X-Ray (mfapi.in for live NAV)
                    ├── Couple's Planner (joint optimization — 100% local)
                    ├── Life Events (template advice + AI enhancement)
                    └── Money Chat (Gemini/Groq stream with full context)
```

**Key design decisions:**
- Every AI feature has a `TemplateService` offline fallback — the app is fully usable without internet
- PII scrubbing before any AI API call (Aadhaar, PAN, phone, email redacted)
- Session rate limit (100 req) + feature-level cooldown guard prevents runaway API spend
- CAMS and Form 16 parsing use Gemini Vision — not Tesseract (which fails on real documents)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.74, Expo SDK 51 |
| Navigation | Expo Router (file-based) |
| State | Zustand |
| Auth | Supabase (OTP), expo-local-authentication (biometric) |
| AI primary | Google Gemini 2.0 Flash + Vision |
| AI fallback | Groq (llama-3.1-8b-instant) |
| Storage | expo-secure-store (profile, JWT, alerts, SIP logs) |
| MF data | mfapi.in (live NAV, scheme metadata) |
| Charts | react-native-svg (custom), victory-native |
| Animations | react-native-reanimated, react-native-animatable |

---

## Features in Detail

### FIRE Planner
- Corpus target with inflation adjustment (6% p.a.) — not the naive 25x formula
- SIP needed calculation using annuity factor
- SVG projection chart (custom, no VictoryChart dependency)
- AI 12-month action roadmap via Gemini with actual rupee numbers
- Tax Battle: old vs new regime live comparison with salary slider

### Money Health Score
- 6 dimensions: emergency (target 6mo), insurance (target 10x), investment (target 20%), debt (<40% DTI), tax (80C usage), retirement (corpus vs FIRE target)
- Monthly score history saved to secure store
- Share card (biometric-gated, no rupee amounts in shared image)

### Portfolio X-Ray
- CAMS statement upload → Gemini Vision → full portfolio reconstruction
- Manual add by AMFI scheme code with live NAV fetch
- True XIRR using Newton-Raphson with actual transaction cashflows
- Fund overlap detection (large-cap + ELSS overlap flagged)
- Expense ratio drag vs 0.1% index benchmark
- AI rebalancing plan with risk alignment, savings velocity, emergency fund, and 80C analysis

### Couple's Planner
- Joint HRA optimization: identifies which partner's tax bracket maximizes exemption
- LTCG harvesting: ₹1.25L tax-free per PAN = ₹2.5L combined
- SIP splits weighted by 80C room available per partner
- Home loan Section 24b + 80C optimization for co-borrowers
- NPS 80CCD(1B) strategy for both partners

### Tax Wizard
- Form 16 image → Gemini Vision → auto-fill salary structure
- Models: 80C, NPS (full ₹50K, not 80%), HRA, 80D, Section 24b home loan, professional tax
- Clearly documents what is NOT modeled (LTA, 80E, 80G, gratuity) — no false confidence
- Ranked tax-saving recommendations by risk profile + liquidity need

---

## Known Limitations

- **Voice check-in** requires a custom development build — `@react-native-voice/voice` does not work in Expo Go
- **Form 16 Tesseract OCR** path is unreliable for real documents; Gemini Vision (used for CAMS) is the reliable path
- API keys are client-side (`.env.local`) — acceptable for hackathon, must move to edge function for production
- Expense ratios in Portfolio X-Ray use category averages, not fund-specific data (mfapi.in doesn't expose this)

---

## Folder Structure

```
app/                    # Expo Router screens
  dashboard/            # Home, Chat, FIRE, Future You, Profile
  portfolio-xray/       # X-Ray screen + components
  couples-planner/      # Joint planner + sub-components
  tax-wizard/           # Tax wizard screen
  health-score/         # Health score screen
  life-events/          # Life events + SIP streak
  auth/                 # OTP auth flow
  onboarding/           # 5-step onboarding

src/
  core/
    models/UserProfile.ts   # All financial calculations (700+ lines, pure functions)
    services/               # GeminiService, AuthService, ProfileService, AlertService
    config/                 # AppConfig, tax slabs, StorageKeys
  components/             # Reusable UI components
```

---

## Impact Model

See `docs/IMPACT_MODEL.md` for the full quantified estimate.

**Summary:** If 1% of ET's 50M MAU adopt ET FinMentor, that's 500,000 users. At ₹25,000/year CA fee savings per user, this represents **₹1,250 crore in annual financial planning cost savings**. Average LTCG tax harvesting across both PAN cards saves ₹15,600/user/year in deferred capital gains tax.

---

## Team

Built for ET Hackathon 2026.

---
