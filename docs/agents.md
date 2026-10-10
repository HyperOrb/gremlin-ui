# Use with a coding agent

Gremlin itself runs without AI. The bundled [skill](../skills/gremlin/SKILL.md) adds a run/inspect/fix/rerun workflow to an agent that can execute shell commands, read JSON, inspect local screenshots, and edit your app.

The skill uses the open Agent Skills format. Its structure is validated in this repository; live execution inside Codex, Claude Code, Cursor, Gemini CLI, and GitHub Copilot has **not** been separately verified. Client support and installation paths vary. Follow your client's current documentation.

For clients that discover project skills under `.agents/skills`, copy `skills/gremlin` into your application's `.agents/skills/gremlin`. For Claude Code, its project skill directory is `.claude/skills/gremlin`. Those are examples, not automatic installers. For other clients, load the SKILL.md directly or ask your agent to follow it.

Example prompt:

> Use the Gremlin skill to test my local application. Read the JSON and screenshots, reproduce the high-confidence findings, fix them, and rerun the same attacks. Report real before/after results and explain unresolved issues.

The package includes the skill, so it remains available after installation. Until npm publication, build from the checkout or install a local packed tarball.
