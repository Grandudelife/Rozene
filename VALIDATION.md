# Validation — 0.4.1 — 2026-09-20

Scope: service launch buttons for Gemini, Flow and Notebook; exact labs.google route for legacy Flow links; portable package and Persian Windows/macOS guide. No Google response rewriting or vendor Flow code.

User evidence: user reports v0.3.0 works in main Chrome on macOS, with account login and actual Gemini reply, after pinning their Tor exit. This is user-reported end-to-end evidence, not an automated developer test. Their Tor/VPN configuration is not bundled.

Automated gate: existing 14 routing/lifecycle tests expanded to cover flow.google.com, notebook.google.com, notebooklm.google.com, labs.google, aisandbox-pa.googleapis.com and domain lookalikes; JavaScript/shell syntax and ZIP manifest root checked.

User evidence for v0.4.0: Flow and Notebook both opened successfully in the same Chrome-on-macOS setup. Generation in Flow and source upload/answer in Notebook were not explicitly confirmed. Not tested: real Chrome installation of 0.4.1 or real Windows Tor setup. Flow account requirements and credits still apply. Tor speed and exit acceptance can change.

Known limitation: optional last-check result lives only for the background worker lifetime; rerun check for a fresh result. It never proves all service requests succeed.

Update: turn off the old extension route, disable the old extension, load the new extracted folder, enable and test. Old archive is retained separately for rollback. No migration of cookies/accounts/Tor configuration.
