CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER,
  phone TEXT,
  email TEXT,
  monthly_income NUMERIC DEFAULT 0,
  annual_income NUMERIC DEFAULT 0,
  monthly_expenses NUMERIC DEFAULT 0,
  monthly_emi NUMERIC DEFAULT 0,
  existing_corpus NUMERIC DEFAULT 0,
  monthly_sip NUMERIC DEFAULT 0,
  emergency_fund NUMERIC DEFAULT 0,
  term_insurance_cover NUMERIC DEFAULT 0,
  health_insurance_cover NUMERIC DEFAULT 0,
  annual_pf NUMERIC DEFAULT 0,
  annual_80c NUMERIC DEFAULT 0,
  annual_nps NUMERIC DEFAULT 0,
  annual_hra NUMERIC DEFAULT 0,
  risk_profile TEXT DEFAULT 'moderate',
  retirement_age INTEGER DEFAULT 55,
  target_monthly_expense_retirement NUMERIC DEFAULT 0,
  goals TEXT[] DEFAULT ARRAY['retirement'],
  total_debt NUMERIC DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data"
  ON user_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS sip_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_month DATE NOT NULL,
  streak_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_month)
);

ALTER TABLE sip_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_streaks"
  ON sip_streaks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS alert_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, alert_type)
);

ALTER TABLE alert_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_alerts"
  ON alert_dismissals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
