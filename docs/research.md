# Targeted landscape check

Checked 2026-10-10. Availability is a snapshot, not a reservation or legal assessment.

- [gremlins.js](https://github.com/marmelab/gremlins.js): JavaScript monkey testing with configurable random interactions. Related name and behavior; this repository is independent.
- [chaosbringer](https://github.com/mizchi/chaosbringer): Playwright-based chaos and fault injection. Gremlin focuses on bounded, repeatable UX detectors and human reproduction reports rather than a general fault-injection toolkit.
- [Gremlin](https://www.gremlin.com/product): an existing reliability/chaos engineering platform. Brand overlap exists. This project is not affiliated with it and makes no novelty or trademark claim.
- [Playwright network APIs](https://playwright.dev/docs/network): context-level HTTP request interception, including popups. Service workers are blocked so they cannot hide HTTP requests from the guard.
- [Agent Skills specification](https://agentskills.io/specification): a directory with SKILL.md and YAML metadata. We package the open format and document client-specific installation without claiming every client was tested.

Direct npm registry checks returned 404 for `gremlin-ui`, `gremlin-ux`, `gremlin-test`, and `try-gremlin`; `gremlin-run` returned 200. Chosen package: **gremlin-ui**. Registry endpoint: https://registry.npmjs.org/gremlin-ui . Recheck immediately before publication.

GitHub repository search for `gremlin ux testing` returned two related results; repository names are scoped to owners. Metadata points to the intended `HyperOrb/gremlin-ui` repository, based on the authenticated GitHub account. No remote repository has been created, and no package has been published.

Differentiation: five deterministic families, a conservative browser guard, report evidence with confidence levels, a real broken/fixed fixture, and a portable agent repair loop. No cloud model, API key, novelty claim, or synthetic benchmark.
