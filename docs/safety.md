# Safety boundaries

Use a **disposable local development app** by default. Remote targets require `--staging`; the flag declares your intent, it does not prove that a URL is staging. The browser API also permits remote targets, so callers must make that decision themselves.

Gremlin applies three layers:

1. Deny dangerous labels and routes, including delete/remove/purchase/payment/send/publish/deploy/account termination. Custom `dangerousKeywords` add to that list. `allowedActions` narrows permitted labels; it cannot override dangerous or denied actions. Matching is conservative and English-first.
2. Intercept every browser-context HTTP request. Inspect HTTP redirect destinations before following them; same-origin navigation redirects are reissued as fresh guarded navigations. Block all methods except GET, HEAD, OPTIONS, all external origins, excluded routes, and dangerous routes. Blocked requests receive an explicit HTTP 409 `{gremlinBlocked:true,error:"GREMLIN_SAFETY_BLOCK"}` response, never a simulated success. Duplicate write attempts are observable; backend execution is not.
3. Block service workers, WebSockets, sendBeacon and WebRTC; dismiss browser dialogs and disable accepted downloads. Fresh contexts isolate scenario state. Context-level routing covers popups; cookies/storage from a supplied session are never exported by Gremlin.

This is a guard against common risks, **not a general application sandbox**. Arbitrary page code still runs. Apps can mutate data through GET, use ambiguous/localized labels, or act before a control is clicked. GET reads can cost money on a poorly designed endpoint. Route/action exclusions and a disposable dataset are still necessary. Extensions should use `context.test()` to obtain the guarded page rather than creating an unguarded browser context.

External CSS, images, fonts, analytics, authentication, and APIs are blocked. Apps depending on them may render differently or fail to load. Same-origin local mocks are the recommended test setup. Authentication redirects cannot be bypassed; use an existing authorized Playwright storageState file if required. Advanced live backend testing and request allowlists are deliberately absent in v0.1.

Reports list all distinct skipped controls and blocked requests. Request payloads are compared in memory for duplicate detection and are not saved in metadata. Screenshots, URLs, DOM labels and errors can contain sensitive application data. No screenshots or reports are uploaded. Chromium downloads contact Playwright's distribution servers on first installation; that is dependency setup, not telemetry.
