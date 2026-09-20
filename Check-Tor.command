#!/bin/bash
# Read-only diagnostic. No downloads, installs, profile edits, or sudo.
set -u
rozane_port="${1:-9150}"
case "$rozane_port" in ''|*[!0-9]*) echo 'Port must be numeric.'; exit 2;; esac
if [ "${#rozane_port}" -gt 5 ] || [ "$rozane_port" -lt 1024 ] || [ "$rozane_port" -gt 65535 ]; then
  echo 'Port must be between 1024 and 65535.'
  exit 2
fi
echo "Checking local SOCKS proxy at 127.0.0.1:$rozane_port (up to 20 seconds)..."
if rozane_result=$(/usr/bin/curl -q --noproxy '' --proxy "socks5h://127.0.0.1:$rozane_port" --connect-timeout 5 --max-time 20 --fail --silent --show-error https://check.torproject.org/api/ip); then
  rozane_compact=$(printf '%s' "$rozane_result" | tr -d '[:space:]')
  case "$rozane_compact" in
    *'"IsTor":true'*) echo 'TOR CHECK PASSED. Gemini generation still needs to be tested in Chrome.';;
    *'"IsTor":false'*) echo 'TOR NOT CONFIRMED by the check service.'; exit 1;;
    *) echo 'Unexpected response from the check service; no successful connection claim.'; exit 1;;
  esac
else
  echo 'CHECK INCOMPLETE. Keep Tor Browser connected. See guide.html for the local port settings.'
  exit 1
fi
