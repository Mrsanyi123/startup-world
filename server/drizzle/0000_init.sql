-- Startup Village initial schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plots (
  id text PRIMARY KEY,
  pos_x double precision NOT NULL,
  pos_y double precision NOT NULL,
  pos_z double precision NOT NULL,
  owner_id text REFERENCES users(id),
  status text NOT NULL DEFAULT 'unclaimed',
  claimed_at timestamptz
);

-- One claimed plot per user. Unclaimed rows may share NULL owner_id.
CREATE UNIQUE INDEX IF NOT EXISTS plots_one_claimed_per_owner
  ON plots (owner_id)
  WHERE status = 'claimed' AND owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS connections (
  id text PRIMARY KEY,
  plot_id text NOT NULL UNIQUE REFERENCES plots(id),
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  provider_account_id text,
  status text NOT NULL DEFAULT 'ok',
  last_error text,
  is_mrr_public boolean NOT NULL DEFAULT false,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id text PRIMARY KEY,
  connection_id text NOT NULL REFERENCES connections(id),
  mrr_cents integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mrr_snapshots_connection_computed
  ON mrr_snapshots (connection_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS house_tiers (
  tier_index integer PRIMARY KEY,
  label text NOT NULL,
  mrr_threshold_cents integer NOT NULL,
  model_ref text NOT NULL
);
