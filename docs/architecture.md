# ET FinMentor — Architecture Document

## Overview

ET FinMentor is a React Native mobile application built on Expo SDK 51. It provides AI-powered personal financial planning across 6 feature areas, with a multi-layer fallback architecture that ensures the app is fully functional even without network connectivity.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER LAYER                                   │
│              React Native App (Expo Go / APK)                   │
│         Expo Router · Zustand state · expo-haptics              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐
│  Supabase   │ │ SecureStore │ │   GeminiService /    │
│   Auth      │ │  (local)    │ │   AI Router          │
│             │ │             │ │                      │
│ OTP phone   │ │ Profile     │ │ Gemini 2.0 Flash     │
│ OTP email   │ │ JWT token   │ │    ↓ (on 429/404)    │
│ Row-Level   │ │ SIP logs    │ │ Groq llama-3.1-8b    │
│ Security    │ │ Alert state │ │    ↓ (always)        │
│ Session     │ │ FIRE history│ │ TemplateService      │
│ refresh     │ │ Score hist. │ │ (offline fallback)   │
└─────────────┘ └─────────────┘ └──────────────────────┘
                                          │
              ┌───────────────────────────┼──────────────────────┐
              ▼                           ▼                      ▼
    ┌──────────────────┐       ┌──────────────────┐   ┌────────────────┐
    │  Gemini Vision   │       │  Text Generation │   │  ChatRouter    │
    │                  │       │                  │   │  (local, fast) │
    │ CAMS statement   │       │ Health tips      │   │                │
    │ Form 16 upload   │       │ FIRE narrative   │   │ Keyword-based  │
    │ Salary slip scan │       │Tax wizard summary│   │ FAQ routing    │
    └──────────────────┘       │ Life event advice│   │ No API call    │
                               │ Portfolio rebal. │   └────────────────┘
                               │Joint optimization│
                               └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  FEATURE MODULES (all pure functions)           │
├────────────────┬───────────────┬──────────────┬─────────────────┤
│ FIRE Planner   │ Tax Wizard    │ Health Score │ Portfolio X-Ray │
│                │               │              │                 │
│ SIP math       │ Slab calc.    │ 6-dim score  │ XIRR (N-R)      │
│ Corpus proj.   │ HRA exemption │ Score hist.  │ Overlap detect  │
│ Asset alloc.   │ 80C/NPS/80D   │ Share card   │ Expense drag    │
│ 12-mo roadmap  │ Regime compare│              │ NAV refresh     │
├────────────────┼───────────────┼──────────────┼─────────────────┤
│ Couple Planner │ Life Events   │ Future You   │ Money Chat      │
│                │               │              │                 │
│ Joint HRA      │ 6 life events │ FIRE twins   │ Streaming AI    │
│ LTCG harvest   │ SIP streak    │ Projections  │ PII scrubbing   │
│ Insurance      │ Monthly card  │ Milestones   │ Context-aware   │
└────────────────┴───────────────┴──────────────┴─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL DATA SOURCES                          │
│  mfapi.in (live NAV)  │  ET Markets RSS  │  expo-notifications  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Roles

### 1. GeminiService (Primary AI Agent)
The central AI coordinator. Manages all calls to Gemini 2.0 Flash and Groq.

**Responsibilities:**
- Builds system instruction with user's full financial snapshot before every call
- Scrubs PII (Aadhaar, PAN, phone, email) from all user inputs before sending to API
- Maintains conversation history for multi-turn chat (max 50 messages, rolling window)
- Tracks session request count (hard limit: 100 req/session to prevent cost overrun)
- Per-feature cooldown: if a feature (e.g., "portfolio-rebalancing") hits a rate limit, it's cooled down for 60 seconds independently — other features continue working
- Automatic Groq preference: if Gemini returns 429 or 404 for a feature, that feature prefers Groq for the next 5 minutes

### 2. ChatRouter (Local FAQ Agent)
Runs entirely on-device. No API call.

**Responsibilities:**
- Keyword-matching for common finance questions (tax, portfolio, insurance, FIRE)
- Returns canned but accurate answers for these topics instead of calling Gemini
- Prevents the AI from giving dangerous advice about portfolio specifics (directs to Portfolio X-Ray instead)
- Fast: responds in <1ms

### 3. TemplateService (Offline Fallback Agent)
A deterministic, offline fallback layer. Always available.

**Responsibilities:**
- Generates financial narratives, health tips, tax summaries, and life event advice from pure calculations
- Called automatically when Gemini/Groq fails for any reason
- Ensures the app is never in a broken state for the user
- Uses the same financial snapshot data as Gemini, so fallback quality is reasonable

### 4. OCRService (Document Parsing Agent)
Handles document uploads.

**Responsibilities:**
- CAMS/KFintech statement: uses Gemini Vision API to extract all holdings with transaction dates
- Salary slip / Form 16: attempts Tesseract OCR (unreliable for complex layouts), falls back gracefully
- Sanitizes parsed data: normalizes category names, validates numeric fields, revives Date objects

---

## How Agents Communicate

```
User input
    │
    ├─→ ChatRouter.routeMessage() ──→ [if match] returns local response immediately
    │
    └─→ GeminiService
            │
            ├─→ AuthService.ensureValidSession() ──→ [if no session] throws AUTH_REQUIRED
            │
            ├─→ scrubPII(userMessage) ──→ sanitized text
            │
            ├─→ buildSystemInstruction(profile) ──→ injects full financial snapshot
            │
            ├─→ fetch Gemini API
            │       ├── 200 OK → return response
            │       ├── 404    → setPreferGroq(feature, 5min) → retry with Groq
            │       ├── 429    → setPreferGroq(feature, 5min) → retry with Groq
            │       └── 403    → throw (invalid key, no fallback)
            │
            ├─→ fetch Groq API (fallback)
            │       ├── 200 OK → return response
            │       ├── 429    → setFeatureCooldown(feature, 60s) → throw
            │       └── 4xx    → throw
            │
            └─→ [caller catches error] → TemplateService offline response
```

---

## Tool Integrations

| Tool | Purpose | Failure handling |
|---|---|---|
| Gemini 2.0 Flash (text) | Health tips, FIRE narrative, tax summary, chat | Auto-fallback to Groq |
| Gemini Vision (multimodal) | CAMS upload, Form 16, salary slip parsing | Error shown to user, manual entry offered |
| Groq llama-3.1-8b | Fallback text generation, ET news AI narrative | Feature cooldown + TemplateService |
| mfapi.in | Live NAV data for portfolio holdings | 20s timeout + 1 retry + silent skip (stale NAV shown) |
| Supabase Auth | OTP phone/email sign-in | Local profile fallback (no sync) |
| Supabase Postgres | Profile sync across devices | Local SecureStore used if offline |
| expo-secure-store | Profile, JWT, SIP logs, alert dismissals, health history | App works fully locally |
| expo-notifications | Financial 911 alerts (push) | Graceful skip if permission denied |
| ET Markets RSS | Financial news headlines | Error card shown, no crash |

---

## Error Handling Logic

### 1. AI Failure Cascade
```
Gemini fails
    → Groq attempt
        → Groq fails (rate limit)
            → TemplateService (offline, always works)
                → User sees accurate offline content with "[offline]" note
```
Every AI-powered feature has a pre-computed fallback. The app is never "broken."

### 2. Network Failure
- All financial calculations are pure functions in `UserProfile.ts` — no network needed
- Health Score, FIRE projection, tax comparison, portfolio XIRR: all work offline
- Chat and document parsing require network — offline state shown clearly

### 3. Session Expiry
- Chat detects `AUTH_REQUIRED` error and shows a "Sign in again" prompt inline
- Profile loads from local SecureStore if Supabase is unreachable

### 4. Rate Limiting
- Session cap: 100 AI requests per app session (prevents runaway costs)
- Per-feature cooldown: 60 seconds after exhaustion (other features still work)
- Groq preference window: 5 minutes after any Gemini failure for that feature

---

## Data Privacy

- **PII scrubbing**: Aadhaar (12-digit), PAN (AAAAA9999A), phone (Indian mobile), email, bank account numbers are all redacted with regex before any AI API call
- **Financial data**: Rupee amounts and financial details ARE sent to Gemini/Groq — this is necessary for personalized advice. This is disclosed in the onboarding flow
- **No data sold**: Anthropic's and Google's standard API terms apply; data is used only for the requested generation
- **Local-first**: Profile, history, and alerts are stored in `expo-secure-store` (hardware-backed on supported devices) — not in plain AsyncStorage
- **Production path**: API keys should move to a Supabase Edge Function before any real-user deployment

---

## State Management

Zustand store (`src/core/services/store.ts`) manages:
- `authStatus` / `session` — authentication state
- `currentProfile` — full user financial profile
- `portfolioXRay` — computed portfolio analysis (auto-computed when profile changes)
- `chatHistory` — conversation history (rolling, 50 messages)
- `jointProfile` — couple's planner data (persisted to SecureStore)
- `demoMode` / `demoPersona` — hackathon demo state

Profile changes automatically trigger `buildPortfolioXRay()` so the dashboard XIRR is always current without a screen visit.