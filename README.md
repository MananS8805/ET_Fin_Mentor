# 🚀 ET FinMentor

**Democratizing Wealth Management for 900 Million Indians**

---

## 📌 The Problem

**95% of India's working population lacks a financial plan** due to prohibitive CA costs (₹25,000-1,00,000/year) and the complexity of Indian tax laws, leaving **900 million people financially vulnerable**.

Only **5 million CAs** serve 900 million people — financial advice is a luxury, not a right.

---

## 💡 The Solution

**An AI-powered financial co-pilot** integrated into the Economic Times ecosystem that automates LTCG tax harvesting, regime optimization, and retirement planning — delivering **₹57,350/year in value per user** at just **₹33.60/year** in infrastructure costs.

> **1,700x Return on Infrastructure** 🔥

---

## ✨ Key Features

### 🧠 Money Health Score
Real-time 6-dimension diagnostic of financial wellness:
- Emergency Fund Coverage
- Debt-to-Income Ratio
- Insurance Adequacy
- SIP Discipline
- Tax Efficiency
- Retirement Readiness

### ⚖️ Tax Wizard
Instant comparison between **Old vs New tax regime** with HRA, 80C, NPS deductions calculated automatically. Know which regime saves you more—instantly.

### 🚜 LTCG Tax Harvester
Automated identification of **₹1.25 lakh tax-free** long-term capital gains booking opportunities (₹2.5L for couples). Save **₹15,625/year** by resetting your cost basis.

### 📊 Portfolio X-Ray
**XIRR-accurate** returns analysis with:
- Mutual fund overlap detection
- Expense ratio drag calculations
- Live NAV refresh (via mfapi.in)
- Category allocation breakdown

### 👫 Couple's Planner
Multi-PAN household optimization for:
- Joint HRA claims
- Combined insurance planning
- Dual LTCG harvesting (₹2.5L total exemption)
- Coordinated SIP allocation

### 🚀 FIRE Path Planner
Retirement roadmap with:
- SIP projections at 12% CAGR
- Inflation-adjusted corpus targets
- Asset allocation recommendations
- 12-month milestone tracker

---

## 🏗️ Tech Stack

| Layer | Technology | Why? |
|-------|-----------|------|
| **Primary LLM** | Gemini 2.0 Flash | High-speed multilingual financial reasoning, free tier |
| **Fallback LLM** | Groq Llama 3.1 8B | Ultra-low latency, auto-switches on rate limits |
| **Backend** | Supabase | PostgreSQL + Auth + Real-time, Row-Level Security |
| **Frontend** | React Native (Expo SDK 51) | Cross-platform iOS/Android, Expo Router v3 |
| **State** | Zustand | Lightweight, performant state management |
| **Storage** | expo-secure-store | Hardware-backed encryption for profile/JWT/SIP logs |
| **Offline Fallback** | TemplateService | Pure TypeScript — zero API calls, 100% offline |
| **OCR** | Gemini Vision API | CAMS statement parsing, Form 16 extraction |

### Why This Stack?

✅ **Cost Efficiency**: Gemini Flash free tier + Groq = **₹2.30/user/month** in AI costs  
✅ **Reliability**: Triple-layer fallback (Gemini → Groq → TemplateService) = **zero downtime**  
✅ **Privacy**: PII scrubbing before every API call (removes Aadhaar, PAN, phone)  
✅ **Offline-First**: FIRE projections, XIRR, tax calculations work **without network**  

---

## 📈 Impact Model

### The Big Numbers

| Metric | Value |
|--------|-------|
| **Total Year 1 Impact** | **₹2,868 Crore** |
| Base Case Users (1% of ET's 50M MAU) | 500,000 |
| Value Delivered Per User (Year 1) | **₹57,350** |
| Infrastructure Cost Per User (Annual) | **₹33.60** |
| **Return on Infrastructure** | **1,700x** 🚀 |

### Value Breakdown (Per User, Annual)

- **₹25,000** — CA Fee Replacement (eliminates chartered accountant retainer)
- **₹15,600** — LTCG Tax Harvesting (₹1.25L exemption booking at 12.5% tax rate)
- **₹8,400** — Tax Regime Optimization (identifies optimal Old/New regime)
- **₹5,400** — Emergency Fund (avoids 18% p.a. personal loan during crisis)
- **₹2,950** — Time Savings (replaces 6 hours of CA consultations)

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  USER LAYER                             │
│         React Native App (Expo Go / APK)                │
│    Expo Router · Zustand state · expo-haptics          │
└──────────────────┬──────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌───────────┐ ┌───────────┐ ┌──────────────────┐
│ Supabase  │ │SecureStore│ │  GeminiService   │
│   Auth    │ │  (local)  │ │   / AI Router    │
│           │ │           │ │                  │
│ OTP Phone │ │  Profile  │ │ Gemini 2.0 Flash │
│ OTP Email │ │JWT Token  │ │  ↓ (on 429/404)  │
│ Row-Level │ │ SIP Logs  │ │ Groq llama-3.1   │
│ Security  │ │ Portfolio │ │  ↓ (always)      │
│           │ │  History  │ │ TemplateService  │
└───────────┘ └───────────┘ └──────────────────┘
                                    │
        ┌───────────────────────────┼───────────────┐
        ▼                           ▼               ▼
┌──────────────┐         ┌──────────────┐  ┌────────────┐
│Gemini Vision │         │Text Generation│  │ChatRouter  │
│              │         │               │  │ (local)    │
│CAMS statement│         │Health tips    │  │Keyword FAQ │
│Form 16 upload│         │FIRE narrative │  │No API call │
│Salary slip   │         │Tax summary    │  └────────────┘
└──────────────┘         │Portfolio rebal│
                         │Life event tips│
                         └──────────────┘

┌─────────────────────────────────────────────────────────┐
│         FEATURE MODULES (all pure functions)            │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│  FIRE    │   Tax    │  Health  │Portfolio │  Couple's  │
│ Planner  │  Wizard  │  Score   │  X-Ray   │  Planner   │
│          │          │          │          │            │
│SIP math  │Slab calc │6-dim calc│XIRR N-R  │Joint HRA   │
│Corpus    │HRA exempt│Score hist│Overlap   │LTCG harvest│
│Asset     │80C/NPS   │          │Expense   │Insurance   │
│alloc     │Regime    │          │drag      │gap         │
└──────────┴──────────┴──────────┴──────────┴────────────┘
```

### Multi-Layer AI Fallback

**Gemini → Groq → TemplateService**

- **Layer 1**: Gemini 2.0 Flash (primary AI, conversational, fast)
- **Layer 2**: Groq Llama 3.1 (auto-switch on 429/404, 5-min preference window)
- **Layer 3**: TemplateService (pure TypeScript, offline, deterministic)

**Always works** — even during API outages or offline scenarios.

---

## 🎯 How to Run

### Prerequisites

- **Node.js 18+**
- **Expo CLI**: `npm install -g expo-cli`
- **API Keys**:
  - Gemini API key (free tier from [ai.google.dev](https://ai.google.dev))
  - Groq API key (free tier from [groq.com](https://groq.com))
  - Supabase project URL + anon key

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/MananS8805/ET_Fin_Mentor.git
cd et-finmentor

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Create .env file in root:
echo "EXPO_PUBLIC_GEMINI_API_KEY=your_key_here" >> .env
echo "EXPO_PUBLIC_GROQ_API_KEY=your_key_here" >> .env
echo "EXPO_PUBLIC_SUPABASE_URL=your_url_here" >> .env
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here" >> .env

# 4. Start the development server
npx expo start

# 5. Run on device
# iOS: Press 'i' (requires Xcode on Mac)
# Android: Press 'a' (requires Android Studio)
# Physical Device: Scan QR code with Expo Go app
```

### Demo Video

🎥 **[2-Minute Walkthrough]** — *[PLACEHOLDER: Add YouTube/Loom link]*

---

## 🌍 Social Impact Beyond Money

### 📚 Financial Literacy at Scale
Every interaction teaches a financial concept **(FIRE, XIRR, LTCG, 80C, HRA)** in context — not in a classroom. Users learn by doing.

### ⚖️ Gender Equity in Financial Decisions
The Couple's Planner makes both partners equal stakeholders. **73% of Indian households** make financial decisions with men alone (RBI Financial Inclusion Survey, 2023). We're changing that.

### 🏘️ Rural & Semi-Urban Reach
Works offline (TemplateService fallback) and supports Hinglish (Gemini multilingual). Financial planning reaches **Tier 2/3 cities** where CAs are scarce.

### 📊 Behavioral Change: SIP Discipline
SIP Streak gamification prevents lapsed SIPs. A 12-month streak user has **₹60,000 more in their corpus** than a lapsed one (at ₹5,000/month SIP).

---

## 💪 Challenges & Learnings

### Challenge 1: India's 2024 Budget LTCG Changes
**Problem**: Budget 2024 changed LTCG tax from 10% to 12.5% and increased exemption from ₹1L to ₹1.25L. Gemini's training pre-dates this.  
**Solution**: Injected Budget 2024 tax slabs into system instruction for every AI call. Validated with TemplateService's hardcoded 12.5% fallback.

### Challenge 2: XIRR Precision vs Speed
**Problem**: Newton-Raphson XIRR converges slowly for portfolios with 50+ transactions (2-3 second lag).  
**Solution**: Aggressive memoization + background recalculation worker. Dashboard now renders instantly with stale-but-recent XIRR.

### Challenge 3: Supabase Rate Limiting During Testing
**Problem**: Free tier Supabase throttles at 500 requests/hour. Profile sync failed repeatedly during rapid-fire testing.  
**Solution**: Debounced profile writes (500ms delay, coalesced updates) + expo-secure-store as primary source of truth. Supabase became sync-only (writes every 5 minutes in background).


---

## 🔮 Future Scope

### The Big Next Steps

- **Direct Broker API Integration**: Execute tax-saving trades (LTCG harvesting, rebalancing) directly via Zerodha/Groww APIs — no manual copy-paste.
- **Voice-First UX**: "Alexa, how's my FIRE progress?" — Google Assistant/Alexa for hands-free financial checkups (critical for low-literacy users).
- **AI Insurance Gap Analyzer**: Scan existing policies (term, health, vehicle), identify under-coverage, auto-generate RFQs with instant quotes.
- **Credit Score Integration**: Pull CIBIL/Experian data, show score alongside Money Health Score, suggest credit-building actions.
- **WhatsApp Bot for SIP Reminders**: Automated messages on SIP due dates + one-tap payment link (reduces lapsed SIPs by 40%).

### Regulatory & Compliance

- **SEBI RIA Registration**: If we cross 150 active users, register as Registered Investment Advisor.
- **Data Residency**: Move from Supabase (US servers) to dedicated India-region Postgres for Personal Data Protection Bill compliance.

---

## 📊 Revenue Model (Post-Hackathon)

1. **Freemium**: Basic features free, Premium ₹499/year for advanced tools (Couple's Planner, Portfolio X-Ray, live NAV refresh). **Est. ₹25 Cr/year at 10% conversion.**
2. **Distribution Fee**: Partner with insurers/AMCs for SEBI-regulated product recommendations. **₹400-800 per successful referral.**
3. **ET Prime Upsell**: Exclusive benefit of ET Prime subscription — retention driver, not direct revenue.

---

## 🤝 Contributing

This is a hackathon project, but we welcome contributions! If you'd like to:

- Report a bug
- Suggest a feature
- Improve documentation
- Submit a pull request

Please open an issue first to discuss what you'd like to change.

---



## 🙏 Acknowledgments

- **Economic Times** for the problem statement and ecosystem
- **Gemini & Groq** for free-tier API access
- **Supabase** for backend infrastructure
- **React Native & Expo** community for the incredible tooling

---

## 📞 Contact

**Team ET FinMentor**

- **GitHub**: MananS8805
- **Email**: manansheth8805@gmail.com

---

<div align="center">

**Making Financial Planning a Right, Not a Luxury** 🚀

*Built with ❤️ for 900 Million Indians*

</div>
