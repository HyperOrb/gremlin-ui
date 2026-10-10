# What detectors prove

| Family     | Observed evidence                                                                                                                            | Limits                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile     | Document width exceeds viewport; visible controls entirely outside horizontal bounds; center hit-test covered by fixed/sticky content        | Deliberate carousels can overflow; does not understand every overlap, clipping, or sticky state                                                   |
| Forms      | Submit event with empty/whitespace required fields or invalid email/URL and no recognized inline errors; long values increase width          | Client handler may validate later; does not prove backend acceptance; only up to 3 forms / 8 fields; authentication and sensitive inputs excluded |
| Navigation | Internal link HTTP failure; history URL mismatch; load/interaction errors; no observed response from pointer controls                        | Up to 8 links / 6 controls; no app-specific semantic expectations; dead-control/history findings require manual review                            |
| Keyboard   | Missing detected focus styling; custom controls absent from Tab order; Enter fails where click changes the interface                         | 24 Tab steps; pseudo-elements and distant focus-within indicators can be missed; no comprehensive accessibility or modal-trap audit               |
| Chaos      | Identical mutation request intents after rapid native clicks; interaction errors; overflow after interaction/resize; blank body after reload | Requests are blocked; server-side deduplication is unknown; up to 5 safe buttons; no general race-condition or business-state oracle              |

Every finding has a confidence field. Medium-confidence focus, inert-control and history observations are candidates for manual review. No detector knows what an arbitrary app should do. There is no AI guessing expected behavior.

## Score

`round(100 × passed / (passed + failed))`

A scenario fails if it observes at least one finding. Multiple findings in one attack do not add multiple penalties. The same finding can fail several viewports; it is deduplicated in the findings list by category/rule/route/selector. Skips and errors are excluded. No evaluated scenarios means a null score, never a fabricated 100. Errors mark the report partial and force CLI exit 2.

The number is a **comparative run metric**, not a scientific UX grade. Compare only runs with the same target, routes, configuration, and evaluated coverage. Severity is separate from the score. A low-severity candidate still marks an attack failed, so inspect the evidence as well as the number.

## Reproducibility

MVP attacks are deterministic; there is no randomness or seed. Finding IDs hash category + rule + URL + selector. Changing port or route changes IDs. Timing and app data can still affect observations. Each scenario gets a fresh context initialized from the same optional storageState. Deep-link loads happen in each context; routes are discovered from the entry page only, with query routes explored only when explicitly listed in includeRoutes.

## Errors and timing

Default navigation timeout is 10 seconds; default settle time is 250ms, increased to 500–650ms for feedback/repeated-click observations. Increase settleMs for slower local apps. Scenario-level failures are recorded and subsequent attacks continue. Initial connection failures produce a concise actionable error. Screenshot failures produce warnings while preserving findings. Browser-launch diagnostics can require Playwright OS dependencies (`npx playwright install --with-deps chromium` on Linux).
