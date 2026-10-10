# CI recipe

The repository workflow builds, formats, tests both fixtures, and uploads actual reports on Ubuntu with Node 22. It is supplied for launch; remote GitHub execution has not been performed locally.

For your own app, insert a local server startup and the CLI after installing dependencies/Chromium. Example shell step in a checkout where Gremlin is installed:

```sh
npm run dev -- --host 127.0.0.1 > app.log 2>&1 &
# Use your project's normal readiness check; do not rely on a fixed sleep.
gremlin http://127.0.0.1:3000 --output gremlin-report --fail-on high
```

Upload `gremlin-report/` with an artifact step configured `if: always()`. The command expects the package to be installed; before publication, build/install from a checked-out Gremlin repository or a local tarball. Separate the application's process lifecycle from Gremlin's own CLI.

`--fail-on high` exits 1 for high/critical findings. Exit 2 always means a usage/run problem or partial coverage. Skips do not fail CI and do not count as passed attacks. Never describe different runs as regressions without comparing matching routes, configuration, data and coverage. Preview URLs need `--staging` and explicit authorization. No automatic PR comment or external message is sent by v0.1.
