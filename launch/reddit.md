I made a local UX chaos tester for the interactions I forget to test

Gremlin behaves like an impatient user: shrink the viewport, submit an incomplete form, tab through controls, follow links, reload and double-click safe actions. It reports observed failures with screenshots and reproduction steps.

It's TypeScript + Playwright, MIT, and doesn't need AI or an API key. There's a real broken/fixed demo so you can inspect what each detector actually catches. It's early: it does not know your business rules, and focus/history/dead-control observations may need manual review.

[Repository link once public]

What user behavior repeatedly breaks your frontend? A small failing/fixed fixture would be incredibly useful. Follow the community's self-promotion rules; this is a draft only.
