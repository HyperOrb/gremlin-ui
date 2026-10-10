# A 20-second live demo

0–4s: Show the real local Fieldnotes workspace and the exact command:
`node dist/cli/index.js http://127.0.0.1:4177/broken --max-pages 2 --headed`

4–10s: Show actual Chromium shrinking to 320px, tabbing and interacting. Time-compress only with an explicit playback-speed label.

10–16s: Open the generated HTML report. Show a real mobile screenshot and the duplicate-request-attempt finding. Say: “All writes were blocked; this is a frontend request signal.”

16–20s: Show actual broken/fixed evaluated denominators and scores from the same demo run. Say: “Your tests use your app correctly. Your users won't.”

For a reproducible README artifact replay: `npm run demo:capture`. It renders real stored output, not a live browser recording. Use the measured numbers from the latest comparison.json; never type invented counts into the video.
