# AGENTS.md

Guidance for AI coding agents working in this repository.

Private Forge app (single Jira Cloud site) that logs deleted work items. See `README.md` for purpose, scopes, install and cutover; this file only covers what you need to work on the code.

## Commands

```bash
npm install && npm --prefix static/main install   # two separate package.json files
npm run build                                     # builds static/main into static/main/build (the Forge resource)
npm test                                          # vitest run (root test/ only)
npx vitest run test/normalize.test.js             # single test file
npx vitest run -t "name of test"                  # single test by name
npm run lint                                      # root eslint, then static/main eslint
forge lint
```

Run `npm run build` before `forge deploy`; the manifest serves `static/main/build`. Never run remote `forge` commands (`register`, `deploy`, `install`, `uninstall`, `tunnel`, `variables set`) without asking the user first; `forge logs` and `forge lint` need `forge login`.

## Architecture

Three entry points exported from `src/index.js` (names must match `handler:` in `manifest.yml`, and `test/index.test.js` enforces the export list): `onIssueDeleted` (product event trigger), `handler` (resolver for the Custom UI), `onRetentionTick` (daily scheduled trigger).

- **Write path:** `events/issueDeleted.js` -> `lib/normalize.js` (pure) -> `kvs.entity('deletion').set(issueId, record)`. Key = issue ID, so redelivery is idempotent. The trigger makes no Jira calls and no `asApp()` calls.
- **Read path:** UI `invoke()` -> `resolvers/index.js`. Every resolver is wrapped in `guarded()`, which runs `assertJiraAdmin()` (`mypermissions?permissions=ADMINISTER` as the user) before touching storage, validates input via `lib/filters.js`, and returns `{ ok, data }` or `{ ok: false, error: 'FORBIDDEN' | 'INVALID_INPUT' | 'INTERNAL' }`. `displayConditions: isAdmin` on the page is UX only.
- **All kvs reads/writes live in `services/deletionStore.js` and `services/retention.js`.** `listDeletions` picks one of four indexes (`by-issue-key`, `by-project`, `by-actor`, `by-deleted-at`); project plus user together use `by-project` with a post-read `Filter`, so pages can be short or empty while `nextCursor` is set. The UI follows cursors accordingly.
- **Retention:** `RETENTION_DAYS` env var (default 365, clamped 30 to 1825). Re-queries the first page each round and deletes with `kvs.batchDelete` in chunks of 25.
- **UI (`static/main`):** React + Vite, `base: './'`. Account IDs are stored, never names; `static/main/src/jira.js` resolves names in the browser with `requestJira` as the current user (batched, cached, 429 handling). CSV building and date helpers (`csv.js`, `dates.js`) are pure and tested from root `test/`; `vitest.config.js` aliases `@forge/bridge` to the UI package's copy for that.

## Gotchas

- **Entity attributes and deployed indexes can never be deleted** (Forge limitation). Do not add attributes or indexes without asking. Phase 2 (restore: `restoredKey`/`restoredAt`/`restoredById`, `issue-snapshot` entity) is deliberately not built; three index slots are reserved for it.
- **Use named imports from Forge CommonJS packages** (`makeResolver` from `@forge/resolver`, `asUser`/`route` from `@forge/api`). A default import such as `import Resolver from '@forge/resolver'` is not a constructor in the Forge ESM bundle and fails at runtime ("is not a constructor"). Vitest hides this; `test/esm-import.test.js` imports `src/index.js` in plain Node to catch it.
- **kvs API names differ from the Forge docs examples:** `WhereConditions.lessThan` (not `isLessThan`), `.filters(new Filter().and(attr, FilterConditions.equalTo(v)))` (no `.andFilter`).
- **Payload fields (from the Phase 0 spike):** `priority` and `labels` are not in the `avi:jira:deleted:issue` payload; `assignee` and `parent` appear only when set. Attribute list is in `lib/normalize.js` and `manifest.yml` and must stay in sync.
- Adding a scope makes the next deploy a major version upgrade; existing installs need `forge install --upgrade`.
- ESLint is pinned to 9.x because `eslint-plugin-react` does not support 10. All dependency versions are pinned exactly.
- `manifest.yml` is gitignored (it holds the registered app id). The committed copy is `manifest.yml.example` with `REPLACE_ME` as the id; mirror every other manifest change there.
- Never log record values (summary, account IDs); log counts and error messages only.
- Style: code, comments and UI text in English; no em dashes anywhere (use a hyphen). Design tokens only (`var(--ds-...)` with fallbacks), no remote assets, no external egress.
