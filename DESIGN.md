# Rozane Tor 0.4.0

Purpose: connect desktop Chrome's Google web traffic to the user's existing local Tor client. Free, no developer-hosted service, no modification of Google responses. Tor Browser remains a runtime dependency. This is not an anonymity product.

Flow: keep Tor connected → disable competing proxy extensions and old Rozane → install → enable route → explicitly test Tor → open Gemini and verify an actual answer. Failure states distinguish proxy ownership, transport test, and Gemini application errors.

Layout: RTL, 360px popup; brand/version; connection status; enable/disable; test/open actions; collapsible port; setup guide/report. Readable guide in a separate tab, max-width 760px. Keyboard focus visible, 44px actions, live status region. No decorative animation.

Tokens: Vazirmatn local; canvas #f5f7f6, surface #ffffff, text #152c29, muted #526662, accent #087568, border #d5dfdc, error #a32f24. 16px body; 24px title; 8/12/16/24px spacing; 12/18px radii. Existing Rozane icon retained as identity.

Acceptance: manifest at ZIP's first folder root; no content scripts or prompt/cookie permissions; exact domain-boundary routing; no DIRECT fallback for targeted hosts; loopback-only proxy; refuse competing owner; disabling clears only our setting; diagnostic excludes browsing data and IP; syntax and mock lifecycle tests; no claim that mock tests prove Chrome/macOS/Gemini compatibility.

## 0.4.0 scope before implementation
Keep the established 360px RTL tokens and status-first flow. One full-width transport test followed by three equal service launch buttons: Gemini, Flow, Notebook. Add labs.google legacy Flow routing; retain all existing Google root boundaries. No country-status response patches or remote vendor code. Same portable extension package for macOS and Windows; local Tor remains required. Provide upgrade, daily startup and sharing instructions. Actual Flow/Notebook success is not inferred from Tor-check success.
