Title: Show HN: Gremlin – UX fuzz testing for web apps

I built Gremlin to challenge the paths happy-path tests miss: tiny viewports, incomplete forms, invisible keyboard focus, browser history, and impatient clicks.

It launches Chromium locally and produces a static HTML report, JSON, screenshots and reproduction steps. No model API key or cloud service. Five bounded detector families; uncertain observations are labeled for manual review. Network writes and dangerous actions are guarded, so duplicate requests are reported as attempts rather than claimed persisted bugs.

The repo includes a deliberately broken/fixed app and real before/after reports, plus an Agent Skill for a run → inspect → fix → rerun workflow. I'd especially appreciate feedback on detector false positives and fixtures for user behaviors I missed.

[Insert the published repository link after launch. Do not post this draft automatically.]
