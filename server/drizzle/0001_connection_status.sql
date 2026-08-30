-- Idempotent: safe on DBs that already ran an older 0000_init.
ALTER TABLE connections ADD COLUMN IF NOT EXISTS provider_account_id text;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok';
ALTER TABLE connections ADD COLUMN IF NOT EXISTS last_error text;
