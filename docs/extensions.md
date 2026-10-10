# Build your own Gremlin

A family implements `Gremlin`: an ID, name, description, and `run(context)`.

```ts
import { run, writeReport, type Gremlin } from 'gremlin-ui';

const emptyState: Gremlin = {
  id: 'empty-state',
  name: 'Empty state experiment',
  description: 'Check a product-specific empty workspace.',
  async run(context) {
    for (const url of context.routes) {
      await context.test(
        'empty-state:workspace',
        'Empty workspace feedback',
        url,
        async (attack) => {
          const count = await attack.page.locator('[data-note]').count();
          const message = await attack.page
            .locator('[data-empty-message]')
            .count();
          if (!count && !message) {
            await attack.find({
              category: 'empty-state',
              rule: 'missing-empty-message',
              severity: 'medium',
              confidence: 'high',
              title: 'Workspace has no empty-state message',
              description:
                'No notes and no product-specific empty-state message were found.',
              whyItMatters: 'Users need a next step in an empty workspace.',
              reproduction: [`Open ${url} with the disposable empty fixture`],
              personalityLine: 'Nothing here. Not even instructions.',
            });
          }
        },
      );
    }
  },
};
const report = await run('http://localhost:3000', {
  output: 'gremlin-report',
  customGremlins: [emptyState],
});
await writeReport(report, 'gremlin-report');
```

`test()` handles fresh contexts, route navigation, guard installation, timings, screenshots, stable IDs, errors, and skipped coverage. `attack.allowed(label, url?)` checks policy before you activate any control. `attack.skip(action, reason)` records a skip and ends the attack. `attack.find()` captures the current page and assigns finding metadata. Prefer real browser input and a concrete oracle; never force-click blocked controls or invent expected behavior.

Use a unique rule and scenario ID for your experiment. Custom Gremlins are a programmatic API; the CLI's JSON config cannot load executable plugins. To contribute a new built-in family, extend the family union and registry and add real before/after fixtures. Place the family in `src/gremlins/my-gremlin.ts`; no framework registration machinery is needed.

## Add a reporter

Consume the exported `Report` type. JSON `schemaVersion: 1` distinguishes future incompatible changes. Keep presentation separate from detection. Escape app-controlled text, restrict link protocols and screenshot paths, and keep outputs local. Call the core `run()` then your reporter; default `writeReport()` produces HTML, JSON, and metadata.
