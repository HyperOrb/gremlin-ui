# Before public launch

- Review the README, screenshots, detector confidence, and safety limits.
- Recheck npm name availability; the earlier check is not a reservation.
- Confirm intended owner/repository metadata (`HyperOrb/gremlin-ui`) before creating the remote.
- Run `npm ci`, `npm test`, `npm run format:check`, `npm run demo:capture` and `npm pack --dry-run`.
- Run the shipped GitHub workflow on a branch; Linux and Windows are not claimed as locally verified.
- Review `npm pack` contents and test a local tarball installation.
- Only after explicit owner approval: create/push GitHub, publish npm, create a release, or post launch drafts.

Suggested first release title: **v0.1.0 — Your users won't use it correctly**

No external publication occurred while building this repository.
