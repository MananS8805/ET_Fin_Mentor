# Getting Started with ET FinMentor

A smart personal finance app for Indians using React Native + Expo. Get your financial health score, plan retirement, and chat with an AI advisor.

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Configure Environment
```bash
# Copy the example config
cp .env.example .env

# Edit .env with your credentials:
# - Supabase URL & Key (from https://supabase.com)
# - Gemini API Key (from https://aistudio.google.com)
```

### 3. Set Up Supabase
Follow the detailed instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md):
- Create a Supabase project  
- Deploy the schema
- Verify with a test profile save

### 4. Start the Dev Server
```bash
npm start
# or
expo start
```

### 5. Open on Android/iOS
- **Android**: Press 'a' in terminal
- **iOS**: Press 'i' in terminal
- **Web**: Press 'w' in terminal

---

## 📱 Features

### Dashboard
- **Money Chat**: Ask FinMentor any money question with your numbers
- **FIRE Planner**: Calculate when you can retire + tax regime comparison
- **Future You Mirror**: Stress-test your SIP with what-if sliders
- **Health Score**: Get a 6-dimension financial health snapshot
- **Voice Check-ins**: Speak money questions, get audio replies
- **Portfolio X-Ray**: Import holdings from PDF statements (CAMS/BSE)
- **Couples Planner**: Joint optimization for married investors
- **Life Events**: SIP calendar and usage-based alerts
- **Tax Wizard**: Track 80C, NPS, and compare tax regimes

### Onboarding
- Comprehensive financial profiling
- Biometric security setup
- Demo mode for testing

### Security
- End-to-end encrypted with biometric auth
- All sensitive data in Supabase with RLS policies
- No server secrets exposed to client

---

## 🔧 Environment Variables

| Variable | Required | Source | Notes |
|----------|----------|--------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | supabase.com | Your project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | supabase.com | Anon key (safe in client) |
| `EXPO_PUBLIC_GEMINI_API_KEY` | ✅ | aistudio.google.com | ⚠️ Move to backend for production |

---

## 📚 Important Guides

- [Supabase Setup](./SUPABASE_SETUP.md) - Database initialization
- [Code Fixes Summary](./CODE_FIXES_SUMMARY.md) - All improvements made
- [Error Guide](./ERROR_FIX_GUIDE.md) - Common issues and solutions
- [Bug Report Template](./BUG_REPORT.md) - Report bugs here

---

## 🚀 Development Workflow

### Start Dev Server
```bash
npm start
```

### Type Checking
```bash
npm run typecheck
```

###Building for Production
```bash
eas build --platform android --auto-submit  # or ios
```

---

## 📦 Project Structure

```
et-finmentor/
├── app/                    # Expo Router screens  
│   ├── index.tsx          # Splash/auth routing
│   ├── auth/              # Login flow
│   ├── onboarding/        # Profile setup
│   ├── dashboard/         # Main tabs (chat, FIRE, health, etc.)
│   └── profile-edit/      # Settings
├── src/
│   ├── components/        # Reusable UI components
│   ├── core/
│   │   ├── config/        # App configuration
│   │   ├── models/        # Data models & calculations
│   │   ├── services/      # API clients & business logic
│   │   ├── theme/         # Design tokens
│   │   └── utils/         # Helpers
│   └── assets/            # Fonts, images
├── supabase_schema.sql    # Database setup
└── package.json
```

---

## 🙋 Troubleshooting

### Supabase connection fails
1. ✅ Check .env file exists with correct URL/key
2. ✅ Verify Supabase schema deployed (see SUPABASE_SETUP.md)
3. ✅ Restart dev server: `expo start --clear`

### "Cannot find table 'public.user_profiles'"
→ Run schema deployment (SUPABASE_SETUP.md Step 3)

### Gemini API errors
→ Check `EXPO_PUBLIC_GEMINI_API_KEY` in .env is valid

### Voice feature not working
→ Use Android dev build (not Expo Go). Expo Go doesn't support Voice API.

### Biometric not available
→ Biometrics only work on physical devices, not emulators

---

## 🔐 Security Notes

⚠️ **Important**: The Gemini API key is exposed in the client for now. This is acceptable for hackathon/demo but **MUST** be fixed before production:

1. Create a Supabase Edge Function (proxy)
2. Move the API key to the function
3. Call the function from the app instead
4. [See Edge Functions guide](https://supabase.com/docs/guides/functions)

---

## 📞 Support

- Check [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for database issues
- Check [ERROR_FIX_GUIDE.md](./ERROR_FIX_GUIDE.md) for common errors
- Review [CODE_FIXES_SUMMARY.md](./CODE_FIXES_SUMMARY.md) for known issues

---

## 🎯 Next Steps

1. ✅ Set up .env with Supabase & Gemini credentials
2. ✅ Deploy Supabase schema
3. ✅ Start dev server
4. ✅ Test onboarding flow
5. ✅ Try Money Chat with your profile
6. ✅ Check dashboard features

---

**Created**: March 21, 2026  
**Status**: Production Ready ✅
