# Real demo and capture

```sh
npm ci
npm run demo
```

This builds the CLI, starts a disposable HTTP fixture on a free port, invokes the real CLI twice, writes broken and fixed reports under `artifacts/`, checks that the backend received zero writes, and stops its own server. It leaves existing servers alone.

The fixture is a fictional notes app called Fieldnotes. Its bugs are ordinary implementation mistakes: desktop-width navigation, suppressed focus, omitted required/native validation, an unbounded input echo, an empty role-button handler, a missing Help route, and an async button without pending protection. The detectors use ordinary DOM/browser evidence, not fixture-specific markers.

```sh
npm run demo:serve
# In another terminal:
node dist/cli/index.js http://127.0.0.1:4177/broken --max-pages 2 --headed
node dist/cli/index.js http://127.0.0.1:4177/fixed --max-pages 2 --output gremlin-fixed
```

`PORT=5000 npm run demo:serve` chooses another port on macOS/Linux. On PowerShell: `$env:PORT=5000; npm run demo:serve`. Do not stop an unrelated process to reclaim a port.

## README media

```sh
npm run demo:capture
```

Requires `ffmpeg` on PATH in addition to Chromium. The script reruns the demo, renders the actual CLI transcript and a real screenshot, captures the generated HTML report, and produces a short GIF at `assets/demo.gif`. This is explicitly an **artifact replay**, not footage of live interaction. It also saves a real report overview at `assets/report.png`. The transcript and source frames remain in `artifacts/capture/` for inspection.

The README GIF is structured as a first-run story rather than a generic slideshow: run one command, watch the five Gremlins execute, inspect one real finding, see the generated report, then see the before/after rerun. Instructional labels are presentation only; detector output, findings, scores, evidence, and comparison numbers come from the fresh demo artifacts.

If ffmpeg is absent, screenshots still exist; install it and run `node scripts/capture.mjs` without rerunning the engine. For live footage instead, record the headed command above with your screen recorder. Use a disposable app and redact private tabs. No generated or embellished detector results belong in demo media.
