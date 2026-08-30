#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Startup Village.
# Ensures Node 24 (required by the repo) + pnpm, then installs workspace deps.
set -euo pipefail

cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

# nvm ships on the default Cloud Agent image; install it if a custom base lacks it.
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

# The repo requires Node 24 (see README). Installing is a no-op once present.
nvm install 24 >/dev/null
nvm use 24 >/dev/null
nvm alias default 24 >/dev/null

corepack enable
corepack prepare pnpm@10.17.1 --activate

# Demo mode needs no secrets; create a local .env from the template if absent.
[ -f .env ] || cp .env.example .env

pnpm install --frozen-lockfile

node --version
pnpm --version
