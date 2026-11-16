// Tabelas do PostgreSQL (criadas/atualizadas na inicialização; idempotente).
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS os_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  friend_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS os_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES os_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_sessions_user ON os_sessions(user_id);
CREATE TABLE IF NOT EXISTS os_profiles (
  user_id UUID PRIMARY KEY REFERENCES os_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  mmr INTEGER NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_profiles_mmr ON os_profiles(mmr DESC);
CREATE TABLE IF NOT EXISTS os_cosmetics (
  user_id UUID PRIMARY KEY REFERENCES os_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS os_friends (
  requester UUID NOT NULL REFERENCES os_users(id) ON DELETE CASCADE,
  addressee UUID NOT NULL REFERENCES os_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester, addressee)
);
CREATE INDEX IF NOT EXISTS os_friends_addressee ON os_friends(addressee);
`;
