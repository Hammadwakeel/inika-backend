#!/bin/bash
#
# journeys-runner.sh
# Wrapper script for the cron-driven guest journey scheduler.
# Activates Node.js v22 and runs the scheduler with OPENCLAW_NO_RESPAWN=1
# to avoid conflicts with the gateway process.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/journeys/journeys.log"

# Prevent gateway start/restart collisions (same guard as run-bot.sh)
if [[ "${1:-}" == "gateway" ]]; then
  echo "Error: journeys-runner.sh does not manage the gateway." >&2
  echo "Use systemctl --user to manage the gateway separately." >&2
  exit 1
fi

# Ensure we're using the right Node.js version
# Prefer nvm-managed node if available, otherwise system
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 22 > /dev/null 2>&1 || true
fi

# Run the scheduler
cd "$SCRIPT_DIR"

# Disable openclaw respawn to avoid gateway conflicts during send
export OPENCLAW_NO_RESPAWN=1

# Optional: set OpenWeatherMap API key if configured
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] journeys-runner.sh starting" >> "$LOG_FILE"

node journeys/scheduler.js "$@" 2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}

echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] journeys-runner.sh finished (exit $EXIT_CODE)" >> "$LOG_FILE"

exit $EXIT_CODE
