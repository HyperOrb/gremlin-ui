# Validation record

Verified locally on 2026-10-10, macOS arm64. Node 26.0.0 and 22.23.3; Playwright 1.64.0; Chromium 156.0.8078.4. This records performed checks, not planned compatibility.

## Results

- Strict TypeScript build and separate typecheck pass.
- 12 automated tests pass, including real Chromium integration, browser request/redirect/popup guards, screenshot dimensions, report filters and 320/390/1280px report layout, stable IDs, CLI failures/init protection, and the custom-family/session contract.
- The full suite also passed on Node 22.23.3. Hosted Linux CI and Windows have not been executed.
- Real CLI broken run: **25/100**, 6/24 evaluated attacks survived; 18 findings (10 high, 7 medium, 1 low); 8 skipped; 0 errors; 21.2 seconds.
- Real CLI fixed run: **100/100**, 23/23 evaluated attacks survived; 0 findings; 9 skipped; 0 errors; 22.5 seconds.
- Common evaluated coverage: **6/23 → 23/23 survived**. The fixed custom-control attack becomes a skip because the control is now native; we do not count a skip as proof of repair.
- Both runs produced HTML, JSON, metadata, actual screenshot evidence, and CLI transcripts. Backend writes **0**; dangerous actions **0**.
- README GIF is a real 15-second artifact replay; generated and visually inspected report overview accompanies it. No live-video claim.
- A packed tarball was installed in an isolated temporary directory. Its generated executable bin printed its version and completed a real four-viewport mobile scan with no findings. The temporary installation was removed after testing.
- Actual automatic browser install into a fresh OS temporary cache succeeded, followed by a four-viewport mobile scan. Total **85.7s** including downloads; the under-60-second target was **not achieved on this connection**. Headless setup downloads only the headless shell, not the full browser. The fresh cache was removed after testing.
- Two earlier custom-cache installs under the workspace failed with a Playwright lock-update error. A full-browser cold-download experiment was canceled in favor of the smaller headless install. The CLI now prints concise install errors and preserves existing cached browser revisions; standard cache/OS temporary cache is recommended.

## Commands actually used

From the project directory:

```sh
npm install
npm ci
npm install --package-lock-only
npx playwright install chromium
npm run build
npm run typecheck
npm run format
npm run format:check
npm test
npx --yes --package=node@22 node --version
npx --yes --package=node@22 node --test
node --test --test-name-pattern='network guard' tests/e2e.test.mjs
npm run demo
npm run demo:capture
npm pack --dry-run --json
npm pack --json > artifacts/pack.json
```

The packed-package smoke test used `npm install --prefix <temporary-directory> --no-audit --no-fund <absolute-project-path>/gremlin-ui-0.1.0.tgz`, followed by that installation's `node_modules/.bin/gremlin --version` and `gremlin <temporary-demo-url>/fixed --mobile --max-pages 1 --output artifacts/package-smoke --no-install`. Full transcript: `artifacts/package-smoke/transcript.txt`.

The fresh-install test started the demo programmatically and ran `node dist/cli/index.js <temporary-demo-url>/fixed --mobile --max-pages 1 --output artifacts/first-run/headless-report` with `PLAYWRIGHT_BROWSERS_PATH` pointing to a fresh OS temporary directory. Transcript/result: `artifacts/first-run/headless-transcript.txt` and `headless-result.json`. Missing-browser behavior with `--no-install` was separately checked and exited 2 with an install command.

## Actual findings from the final demo run

Multiple observations can describe one root cause on different routes/viewports. Focus findings group affected controls per page. No claim of 18 independent source bugs.

| ID            | Rule                        | Severity | Selector                                                                            |
| ------------- | --------------------------- | -------- | ----------------------------------------------------------------------------------- |
| GR-06a11529a0 | horizontal-overflow         | medium   | header                                                                              |
| GR-3823ce13d0 | control-outside             | high     | #help                                                                               |
| GR-5ccf5c1909 | control-outside             | high     | body:nth-of-type(1) > header:nth-of-type(1) > nav:nth-of-type(1) > a:nth-of-type(4) |
| GR-7ee328b02a | horizontal-overflow         | medium   | header                                                                              |
| GR-827d7557fe | control-outside             | high     | #help                                                                               |
| GR-01aff26c61 | control-outside             | high     | body:nth-of-type(1) > header:nth-of-type(1) > nav:nth-of-type(1) > a:nth-of-type(4) |
| GR-6420467cb2 | empty-submission            | high     | #draft-form                                                                         |
| GR-f17c43a14e | invalid-submission          | medium   | #draft-form                                                                         |
| GR-b68290f80d | whitespace-submission       | high     | #draft-form                                                                         |
| GR-6562219e61 | long-value-overflow         | medium   | #draft-form                                                                         |
| GR-b8ff17771a | broken-link                 | high     | #help                                                                               |
| GR-06c1cee649 | inert-control               | low      | #template                                                                           |
| GR-fcb64fad05 | broken-link                 | high     | #help                                                                               |
| GR-7458532bd7 | no-visible-focus            | medium   | #home                                                                               |
| GR-e9c83f1f51 | pointer-only-control        | high     | #template                                                                           |
| GR-2f2655fc16 | no-visible-focus            | medium   | #home                                                                               |
| GR-f53d30dee1 | duplicate-request-intent    | high     | #preview                                                                            |
| GR-8e192ca244 | interaction-resize-overflow | medium   | #preview                                                                            |

## Fixed during implementation review

- Corrected the unexported Playwright CLI resolution path.
- Fixed 320px report overflow and verified responsive filtering.
- Closed an HTTP redirect guard gap with a controlled external server regression.
- Compared double-click requests with a single-click baseline before reporting extra attempts.
- Grouped focus observations and limited terminal findings to six prioritized entries.
- Captured viewport-only screenshots and recorded the observed viewport after resize, not the starting size.
- Canonicalized safe entry redirects and tested existing-session and custom-family support.

## Remaining limits

This is an early heuristic engine, not proof of perfect UX. Inert-control, focus and history warnings require manual review. State-changing GETs and arbitrary app code are outside a complete sandbox guarantee. External assets/APIs are deliberately blocked. Full modal trapping, semantic state loss, offline and slow-network oracles remain future work. Windows, hosted Linux CI, and client-specific Agent Skill execution are unverified. Nothing was published externally.
