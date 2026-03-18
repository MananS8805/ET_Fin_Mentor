# ET FinMentor — Codex Build Prompt

## Project overview

Build a React Native mobile app called **ET FinMentor** using **Expo (SDK 51)**, **Expo Router**, and **TypeScript**. The app is an AI-powered personal finance mentor for India — it helps ordinary Indians (who can't afford a ₹25,000/year CA) get personalized financial advice, a health score, FIRE planning, and tax guidance for free.

Target: Android physical device. Package manager: npm.

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | React Native + Expo SDK 51 |
| Routing | Expo Router v3 (file-based, like Next.js) |
| Language | TypeScript (strict) |
| Auth | Supabase Auth — Phone OTP (SMS via Twilio) + Email OTP |
| Database | Supabase Postgres with Row Level Security |
| AI | Google Gemini 2.0 Flash (free tier, 1M tokens/day) |
| State | Zustand |
| Secure storage | expo-secure-store (AES-256) |
| Biometric | expo-local-authentication |
| Fonts | Syne Bold + DM Sans (loaded via expo-font) |
| Charts | victory-native |
| Animations | react-native-reanimated + react-native-animatable |

---

## Environment variables

All secrets go in a `.env` file at the project root using the `EXPO_PUBLIC_` prefix so Expo exposes them at runtime:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyxxx
```

Read them in code as `process.env.EXPO_PUBLIC_SUPABASE_URL`. Never hardcode secrets.

---

## Design system

### Colors
```ts
navy:   '#0C2340'   // primary brand, app bars, auth screens
gold:   '#F5A623'   // accent, CTAs, active tabs
teal:   '#1D9E75'   // success, positive metrics
red:    '#E24B4A'   // alerts, errors
purple: '#7F77DD'   // AI / wow features
surface: '#F6F7F9'  // screen background
card:   '#FFFFFF'   // card background
border: '#E5E7EB'   // 0.5px borders
textPrimary:   '#111827'
textSecondary: '#6B7280'
textMuted:     '#9CA3AF'
```

### Typography
- Display/headings: `Syne-Bold` font — use for titles, numbers, logo
- Body/labels: `DMSans-Regular` and `DMSans-Medium` — use for all body text
- Financial numbers always use `Syne-Bold`

### Rules
- All borders: `0.5px` width, `Colors.border` color
- Border radius: sm=8, md=12, lg=16, full=999
- Button height: 52px
- No shadows except `elevation: 2` for floating elements
- App bars always navy background, white text
- Bottom tab bar always navy, gold for active tab

---

## Project directory structure

```
et-finmentor/
├── .env                          ← secrets (never commit)
├── .gitignore                    ← must include .env
├── app.json                      ← Expo config
├── babel.config.js               ← includes reanimated plugin
├── tsconfig.json
├── package.json
├── supabase_schema.sql           ← run once in Supabase SQL editor
│
├── assets/
│   ├── fonts/
│   │   ├── Syne-Bold.ttf
│   │   ├── Syne-SemiBold.ttf
│   │   ├── DMSans-Regular.ttf
│   │   └── DMSans-Medium.ttf
│   └── images/
│       ├── icon.png
│       └── splash.png
│
├── app/                          ← Expo Router screens
│   ├── _layout.tsx               ← root layout, font loading, Stack navigator
│   ├── index.tsx                 ← splash screen
│   ├── auth/
│   │   ├── _layout.tsx
│   │   └── index.tsx             ← phone OTP → email OTP → biometric
│   ├── dashboard/
│   │   ├── _layout.tsx           ← bottom tab navigator (5 tabs)
│   │   ├── index.tsx             ← home tab
│   │   ├── chat.tsx              ← money chat tab
│   │   ├── future-you.tsx        ← future you mirror tab
│   │   ├── fire-planner.tsx      ← FIRE planner tab
│   │   └── profile.tsx           ← profile + security tab
│   ├── onboarding/
│   │   └── index.tsx             ← 5-screen wizard + salary slip scanner
│   ├── health-score/
│   │   └── index.tsx             ← money health score
│   ├── voice-alerts/
│   │   └── index.tsx             ← voice chat + 911 alerts
│   └── life-events/
│       └── index.tsx             ← life event advisor + SIP streak
│
└── src/
    └── core/
        ├── config/index.ts       ← AppConfig (reads process.env)
        ├── models/UserProfile.ts ← financial data model + all math
        ├── services/
        │   ├── supabase.ts       ← Supabase client singleton
        │   ├── AuthService.ts    ← SMS OTP, email OTP, biometric, JWT
        │   ├── GeminiService.ts  ← AI calls, PII scrubbing, context injection
        │   └── store.ts          ← Zustand global state
        └── theme/index.ts        ← Colors, Typography, Spacing, ComponentStyles
```

---

## Core data model — UserProfile

This is the most important file. All financial math runs here in pure TypeScript — no API calls, works offline.

```ts
interface UserProfileData {
  id: string;
  name: string;
  age: number;
  phone: string;         // +91XXXXXXXXXX format
  email: string;

  // Income
  monthlyIncome: number;
  annualIncome: number;
  monthlyExpenses: number;
  monthlyEMI: number;

  // Investments
  existingCorpus: number;    // total current investments
  monthlySIP: number;
  emergencyFund: number;

  // Insurance
  termInsuranceCover: number;
  healthInsuranceCover: number;

  // Tax
  annualPF: number;
  annual80C: number;         // max ₹1,50,000
  annualNPS: number;
  annualHRA: number;

  // Goals
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  retirementAge: number;
  targetMonthlyExpenseRetirement: number;
  goals: string[];

  totalDebt: number;
  onboardingComplete: boolean;
}
```

### Math functions to implement

```ts
// Savings
getMonthlySavings(p)      // monthlyIncome - monthlyExpenses - monthlyEMI
getSavingsRate(p)         // (savings / income) * 100

// Emergency
getEmergencyFundMonths(p) // emergencyFund / monthlyExpenses
getRecommendedEmergencyFund(p) // monthlyExpenses * 6

// Insurance
getInsuranceMultiple(p)   // termInsuranceCover / annualIncome
getInsuranceGap(p)        // max(0, annualIncome * 10 - termInsuranceCover)

// FIRE — 4% safe withdrawal rate
getFireCorpusTarget(p)    // targetMonthlyExpense * 12 * 25

// FV projection (compound interest)
projectedCorpusAtAge(p, targetAge, cagr=0.12)
  // fvLump = existingCorpus * (1+cagr)^years
  // fvSIP  = monthlySIP * ((1+r)^n - 1) / r) * (1+r)  [annuity due]
  // return fvLump + fvSIP

// Reverse — SIP needed to hit target
sipNeededFor(p, targetCorpus, targetAge, cagr=0.12)

// Monthly passive income at 4% SWR
getMonthlyPassiveIncome(corpus)  // (corpus * 0.04) / 12

// Health score — each dimension 0-100
getHealthScoreDimensions(p) returns:
  emergency:  min(months/6, 1) * 100
  insurance:  min(multiple/10, 1) * 100
  investment: min(sip/income/0.20, 1) * 100
  debt:       max(0, 1 - debtRatio/50) * 100
  tax:        min(80C/150000, 1) * 100
  retirement: min(corpus/fireTarget, 1) * 100

getOverallHealthScore(p)  // average of 6 dimensions

// Tax — FY2024-25 Indian slabs
getOldRegimeTax(p)        // income - 50000(std) - 80C - 0.8*NPS → slab
getNewRegimeTax(p)        // income - 75000(std) → slab
getBetterRegime(p)        // 'old' | 'new'
getTaxSaving(p)           // |newTax - oldTax|

// Indian number formatter
formatINR(value, compact=false)
  // compact: ₹12.5L, ₹2.3Cr
  // full:    ₹12,50,000
```

### Tax slabs (FY2024-25)

**Old regime** (after deductions):
- Up to ₹2.5L: 0%
- ₹2.5L–₹5L: 5%
- ₹5L–₹10L: 20%
- Above ₹10L: 30%

**New regime** (standard deduction ₹75,000):
- Up to ₹3L: 0%
- ₹3L–₹7L: 5%
- ₹7L–₹10L: 10%
- ₹10L–₹12L: 15%
- ₹12L–₹15L: 20%
- Above ₹15L: 30%

### 3 demo personas (hardcode in UserProfile.ts)

```
Rohan: age 28, income ₹82K/month, SIP ₹8K, corpus ₹2.3L, risk: moderate, retire at 55
Priya: age 35, income ₹1.4L/month, SIP ₹25K, corpus ₹12L, risk: aggressive, retire at 50
Vikram: age 45, income ₹2.1L/month, SIP ₹30K, corpus ₹45L, EMI ₹45K, risk: conservative, retire at 60
```

---

## Auth flow (5 steps, all on navy background)

```
Step 1: Phone entry
  - +91 prefix fixed, 10-digit input
  - "Send OTP" → supabase.auth.signInWithOtp({ phone })
  - Rate limit: 3 attempts then 1-hour lockout

Step 2: SMS OTP verification
  - 6 individual boxes (one digit each, auto-advance on type)
  - 60-second countdown before resend
  - supabase.auth.verifyOtp({ phone, token, type: 'sms' })

Step 3: Email entry
  - Optional — "Skip for now" link visible
  - supabase.auth.signInWithOtp({ email })

Step 4: Email OTP verification
  - Same 6-box UI
  - supabase.auth.verifyOtp({ email, token, type: 'email' })

Step 5: Biometric setup
  - expo-local-authentication
  - "Enable biometric" or "Skip" options
  - Store preference in expo-secure-store

On success: store JWT in expo-secure-store, navigate to /dashboard
On app reopen: restore session → if valid + biometric enabled → biometric prompt → dashboard
```

Step progress bar: 5 segments at top, gold = current, teal = done, dim = pending.

---

## Gemini AI service

Every AI call must:
1. Check auth session first — if expired, try silent refresh, if fails return auth error
2. Scrub PII from user messages before sending:
   - Aadhaar: 12-digit → `[AADHAAR]`
   - PAN: ABCDE1234F → `[PAN]`
   - IFSC: ABCD0123456 → `[IFSC]`
   - Bank account numbers (9-18 digits) → `[ACCOUNT]`
   - Indian mobile numbers → `[MOBILE]`
3. Inject full UserProfile as system prompt (financial numbers only, no name/phone/email)
4. Maintain conversation history for multi-turn chat

System prompt personality:
```
You are FinMentor — a friendly CA and personal finance advisor for India.
- Speak like a knowledgeable friend, not a textbook
- Always use the user's exact ₹ numbers in advice
- Give specific fund categories (Nifty 50 index, ELSS, liquid funds) — no stock picks
- Keep responses under 150 words unless asked for detail
- End complex advice with "Next step:" — one clear action
- Format amounts Indian style: ₹12,34,567
- Occasional Hinglish is fine if user writes in Hindi
```

Gemini API endpoint:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=KEY
Body: { system_instruction, contents: [...history], generationConfig: { temperature: 0.7, maxOutputTokens: 450 } }
```

---

## Supabase schema (3 tables)

```sql
-- user_profiles: one row per user, RLS enforced
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT, age INTEGER,
  monthly_income NUMERIC, annual_income NUMERIC, monthly_expenses NUMERIC,
  monthly_emi NUMERIC DEFAULT 0, existing_corpus NUMERIC DEFAULT 0,
  monthly_sip NUMERIC DEFAULT 0, emergency_fund NUMERIC DEFAULT 0,
  term_insurance_cover NUMERIC DEFAULT 0, health_insurance_cover NUMERIC DEFAULT 0,
  annual_pf NUMERIC DEFAULT 0, annual_80c NUMERIC DEFAULT 0,
  annual_nps NUMERIC DEFAULT 0, annual_hra NUMERIC DEFAULT 0,
  risk_profile TEXT DEFAULT 'moderate', retirement_age INTEGER DEFAULT 55,
  goals TEXT[] DEFAULT ARRAY['retirement'],
  total_debt NUMERIC DEFAULT 0, monthly_emi NUMERIC DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON user_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- sip_streaks: monthly SIP log
CREATE TABLE sip_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  log_month DATE NOT NULL,
  streak_count INTEGER DEFAULT 1,
  UNIQUE(user_id, log_month)
);
ALTER TABLE sip_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_streaks" ON sip_streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- alert_dismissals: which 911 alerts user has seen
CREATE TABLE alert_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, alert_type)
);
ALTER TABLE alert_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_alerts" ON alert_dismissals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## 8 features to build (one per day, Days 1–8)

### Day 1 — Foundation + Auth
- Project scaffold with Expo Router
- Design system (colors, fonts, component styles)
- UserProfile model with all math
- AuthService (SMS OTP + email OTP + biometric + JWT)
- GeminiService (auth-gated + PII scrubbed)
- Zustand store
- Splash screen with 5-tap demo mode trigger
- Auth screen (5-step flow)
- Dashboard shell (5 tabs, placeholders for Days 2–8)

### Day 2 — Onboarding + Salary Slip Scanner
- 5-screen PageView wizard: personal info → income → investments → insurance → goals
- Progress bar, validation, "Back" navigation
- Salary slip scanner: expo-image-picker → base64 → Gemini Vision → parse JSON → auto-fill form
- Save profile to Supabase + local secure store
- On complete: navigate to dashboard home

### Day 3 — Money Health Score
- 6-dimension score calculation (all offline Dart math from UserProfile.ts)
- Animated circular ring showing overall score (0–100)
- 6 dimension bars: Emergency / Insurance / Investment / Debt / Tax / Retirement
- Score category label: Critical (<40) / Needs Work (40–60) / Good (60–80) / Excellent (>80)
- AI improvement tips: single Gemini call → 3 specific actions
- Shareable card (expo-view-shot + expo-sharing): score, 3 insights, ET branding — no ₹ amounts in share

### Day 4 — WhatsApp-style Money Chat
- Chat UI: dark navy bubbles for user, white bubbles for AI
- Animated typing indicator (3 bouncing dots)
- 6 quick-reply chips that appear after welcome message
- Full UserProfile injected as Gemini system context
- PII masking on every user message before API call
- Conversation history persisted in Zustand (cleared on sign-out)
- Long-press to copy message
- Session expiry handling: show inline "Session expired" message

### Day 5 — Future You Mirror
- Age slider (current+5 to 70): drag → corpus animates with TweenAnimation
- Big number: projected net worth at selected age
- FIRE status badge: "Building towards FIRE" → "FIRE achieved 🎉" when corpus ≥ target
- Two what-if sliders: SIP multiplier (0.5x–3x) and CAGR (6%–20%)
- Milestone cards: emergency fund / half-FIRE / full FIRE with progress bars
- Bar chart: ages in 5-year steps, selected age highlighted in gold
- AI narrative: short Gemini call (debounced 800ms) — 2 sentences about what the number means
- Share card: shows corpus at target age + ET branding — biometric confirmation before share

### Day 6 — FIRE Planner + Tax Battle
- FIRE planner: input retirement age + target monthly expense → required SIP, years to FIRE, asset allocation schedule
- Projection chart (victory-native line chart): projected corpus vs target over time
- Tax battle: two side-by-side cards, salary slider ₹5L–₹50L, live old vs new regime recalculation
- Winner badge animates between cards at breakeven point
- "Switch regime, save ₹X this year" — one Gemini call for narrative
- PDF-style export (react-native-view-shot screenshot + share) — biometric required

### Day 7 — Voice Check-in + Financial 911 Alerts
- Mic button in chat: @react-native-voice/voice for on-device STT
- Animated waveform while listening (4 bars, sine heights)
- Transcript → GeminiService.sendMessage() → TTS reply via expo-speech
- Auto-detect Hindi/English and respond in same language
- Microphone stops when app goes to background (AppState listener)
- 8-rule Financial 911 alert engine (runs on app open, pure offline logic):
  1. Emergency fund < 3 months
  2. Term insurance < 8x salary
  3. No SIP active (monthlySIP === 0)
  4. 80C under ₹1L (more than ₹50K unused)
  5. Insurance gap > ₹50L
  6. Debt-to-income ratio > 40%
  7. No health insurance
  8. Retirement corpus < 10% of target
- Alerts shown as red priority cards on dashboard home
- Notifications via expo-notifications: payload = alert ID only, no financial data

### Day 8 — Life Event Advisor + SIP Streak + Monthly Card
- 6 life event cards (grid): Bonus / Marriage / Baby / Inheritance / Job switch / Buy home
- Each card injects event + full profile into Gemini → streaming response with typewriter effect
- Structured response: Immediate (0–30 days) / Soon (1–6 months) / Long term
- SIP streak: monthly log calendar, flame counter, milestone badges at 3/6/12 months
- Confetti (react-native-confetti-cannon) on streak milestone
- Monthly money card: auto-generated on month end, income vs expenses vs saved as percentages
- Share card (9:16 ratio for Instagram Stories) — shows percentages not ₹ amounts

---

## Security requirements (applied across all features)

- All JWT tokens stored in `expo-secure-store` only — never AsyncStorage or state
- OTP attempt tracking in-memory: 3 wrong attempts → 1-hour lockout per phone/email
- PII scrubbing regex on every Gemini call (Aadhaar, PAN, IFSC, account numbers, phones)
- Session check before every Gemini call — silent refresh on 401, redirect to auth if refresh fails
- Notification payloads contain zero financial data — only alert IDs
- Shareable cards show percentages/scores, never ₹ amounts
- Biometric confirmation required before: PDF export, sharing detailed cards, deleting account
- Microphone permission requested at tap-time only, never at app launch
- Mic recording stops immediately when app goes to background

---

## Demo mode (for judges)

Hidden trigger: tap the FM logo on splash screen 5 times quickly.

On activation:
- Set `et_finmentor_demo_mode = 'true'` in expo-secure-store
- Load Rohan's demo profile
- Skip auth entirely, navigate to dashboard
- Show "DEMO" badge in app bar

In demo mode, users can switch between Rohan / Priya / Vikram personas from the Profile tab. Each persona has full financial data pre-loaded.

To exit demo mode: Profile → Sign out.

---

## Key packages (all in package.json)

```json
"expo": "~51.0.0",
"expo-router": "~3.5.0",
"@supabase/supabase-js": "^2.43.5",
"react-native-url-polyfill": "^2.0.0",
"@react-native-async-storage/async-storage": "1.23.1",
"expo-secure-store": "~13.0.2",
"expo-local-authentication": "~14.0.1",
"expo-image-picker": "~15.0.7",
"expo-sharing": "~12.0.1",
"expo-notifications": "~0.28.8",
"expo-haptics": "~13.0.1",
"react-native-reanimated": "~3.10.1",
"react-native-gesture-handler": "~2.16.1",
"victory-native": "^41.1.0",
"react-native-gifted-chat": "^2.6.3",
"zustand": "^4.5.4",
"react-native-view-shot": "^3.8.0",
"@react-native-voice/voice": "^3.2.4",
"react-native-confetti-cannon": "^1.5.2",
"react-native-animatable": "^1.4.0",
"date-fns": "^3.6.0"
```

---

## How to run

```bash
# 1. Install dependencies
npm install

# 2. Create .env with your keys (see Environment variables section above)

# 3. Place 4 font files in assets/fonts/

# 4. Install Expo Go on Android phone (Play Store)

# 5. Start dev server (phone and laptop must be on same WiFi)
npx expo start --android

# 6. Scan QR code with Expo Go app
```

---

## What to build first (start here)

Build in this exact order — each step depends on the previous:

1. `src/core/config/index.ts` — AppConfig reading env vars
2. `src/core/theme/index.ts` — Colors, Typography, Spacing, ComponentStyles
3. `src/core/models/UserProfile.ts` — data model + all math + 3 demo personas
4. `src/core/services/supabase.ts` — Supabase client
5. `src/core/services/AuthService.ts` — SMS OTP + email OTP + biometric
6. `src/core/services/GeminiService.ts` — AI calls + PII scrubbing
7. `src/core/services/store.ts` — Zustand store
8. `app/_layout.tsx` — root layout + font loading
9. `app/index.tsx` — splash screen + 5-tap demo trigger
10. `app/auth/_layout.tsx` + `app/auth/index.tsx` — full 5-step auth flow
11. `app/dashboard/_layout.tsx` — tab navigator
12. `app/dashboard/index.tsx` — home tab with completion card
13. Placeholder files for all other tabs
14. Then build each feature day by day (Days 2–8)