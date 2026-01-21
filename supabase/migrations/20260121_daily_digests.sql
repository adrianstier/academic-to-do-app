-- Daily Digests Table
-- Stores pre-generated digest content for scheduled delivery (5am and 4pm)

CREATE TABLE IF NOT EXISTS daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  digest_type TEXT NOT NULL CHECK (digest_type IN ('morning', 'afternoon')),
  digest_data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  digest_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_daily_digests_user_date
  ON daily_digests(user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_digests_user_type
  ON daily_digests(user_name, digest_type, generated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_digests_unique_per_day
  ON daily_digests(user_id, digest_type, digest_date);

ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own digests" ON daily_digests
  FOR SELECT USING (true);

CREATE POLICY "Allow digest creation" ON daily_digests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow digest updates" ON daily_digests
  FOR UPDATE USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE daily_digests;
