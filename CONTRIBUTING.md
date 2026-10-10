# Contributing

A useful detector with a clear reproduction beats ten speculative findings. Small fixes, real fixtures, and new Gremlins are welcome.

```sh
npm ci
npx playwright install chromium
npm test
npm run demo
```

Node.js 22+ is required. Current validation was performed on macOS arm64; Linux CI is provided, Windows is not yet verified.

- `src/core`: schema, configuration, per-attack isolation, score and runner.
- `src/safety`: action/route policy and network guards.
- `src/discovery`: DOM snapshots and control lookup.
- `src/gremlins`: five bounded detector families.
- `src/reporters`: static HTML, terminal and machine-readable output.
- `demo`: real HTTP fixture, broken and fixed variants.
- `tests`: unit, CLI, browser safety and full broken/fixed regression tests.

Read [Build your own Gremlin](docs/extensions.md), [Detection limits](docs/detection.md), and [Safety](docs/safety.md) before adding interactions. A detector PR should show one real failing fixture and one fixed fixture, evidence/steps, confidence and possible false positives. Preserve deny rules; a label allowlist must never override a destructive-action deny.

Run `npm run format` then `npm test` and `npm run format:check` before a PR. Prettier is the formatting convention; strict TypeScript is the static check. Keep dependencies small. No analytics, cloud keys, or remote data uploads.

A bug report needs your OS, Node version, CLI version, command, and a minimal fixture when possible. Strip private URLs, cookies and screenshots before sharing artifacts. No CLA or complex contribution ceremony for v0.1.
