# Validation — 0.5.0 — 2026-10-04

## Problem and changes
The old popup could open a Google service while its proxy was off. All four service launches now go through the background queue, establish and verify proxy ownership, then create the tab. AI Studio is added. The user can choose a loopback Tor/SOCKS5/HTTP endpoint. Exact 0.4.1 PAC remains recognized across reloads. Permissions are unchanged.

## Automated evidence
24 Node tests pass: service domains and boundaries; no direct fallback; port/type injection; ownership checks; enable/disable and serialization; no Google tab on control failure; selected custom profile at launch; proxy test classification; legacy PAC recognition; no exit-IP diagnostics; runtime assets and permissions.

## Live evidence and limits
- Inspected the already-installed 0.4.1 on macOS Chrome: its route initially showed off.
- Enabled its existing route; its Tor test returned success.
- Gemini still showed “Gemini isn’t currently supported in your country.”
- The local Tor config pinned one old exit; no domain omission was found in the existing Gemini routing rules.
- The system VPN exit was classified DE by Cloudflare. The WireGuard endpoint alone does not determine final egress country.
- Multiple isolated US Tor circuits returned HTTP 403 for the public Gemini app. A supported-country pool produced both 403 and 200 responses.
- Identified an accepted exit via this probe's Tor STREAM events and selected its relay fingerprint temporarily. Tor's GeoIP classified it DE. Public Gemini returned HTTP 200 and AI Studio returned HTTP 302 (unauthenticated); these do not prove signed-in app success.
- After successful signed-in Gemini testing, persisted only the selected ExitNodes fingerprint in local torrc, with a private backup. The fingerprint is not bundled with the extension. No cookies, account metadata, IPs, bridge configuration, Tor control cookies or VPN keys are committed.

Installed 0.5.0 was reloaded successfully in the existing Chrome extension. Verified in the real popup that opening Gemini while off first enables the route. Signed-in Gemini displayed Germany “From your IP address” and returned “connection OK” to a simple prompt in a temporary chat. AI Studio opened its signed-in Playground at /prompts/new_chat with the prompt editor visible and no region error. No API key was linked and no paid/agent run was started. Flow opened its signed-in project listing at flow.google.com with no region error. No generation was started and no credits were consumed by this test. Windows is untested. Tor exit acceptance can change. Connectivity tests and public HTTP responses never imply successful generation or chat.
