# AGENTS.md

Guidance for AI coding agents working in this repository.

Private Forge app (single Jira Cloud site) that logs deleted work items. See `README.md` for purpose, scopes, install and cutover; this file only covers what you need to work on the code.

<!-- standards:start -->
## Shared standards

These rules apply to every Forge app we build. The source is `STANDARDS.md` in `../it-operations-forge-template`, and `scripts/sync.sh` copies it here: edit it there, not here. The app-specific sections of this file add to these rules and win when they conflict.

### Workflow

- After cloning, run `npm run setup` once: it installs dependencies and enables the pre-commit hook. `npm run check` must pass before every commit. The hook runs `npm run check:fast`, CI runs `npm run check` on every push.
- Never run `forge deploy`, `forge install`, `forge uninstall`, `forge register`, `forge variables set` or any other environment change yourself: print the exact commands and let the user run them. `forge lint` needs a login, so the user runs it before a deploy.
- `forge deploy` does not build the UI: build first. The user hard refreshes Jira after a deploy.
- Commit or push only when the user asks. User-visible changes go under `## Unreleased` in `CHANGELOG.md`.
- Shared files (see the template README) change in the template first, then `scripts/sync.sh` copies them into each app.

### Privacy and security

- Frontend only by default: no resolvers, no `@forge/api`, no `asApp()`, no Forge storage, KVS or SQL, no triggers, unless this app's own sections say otherwise. If a call fails as the user, do not switch to `asApp()`.
- No external egress (`permissions.external`), no remote CDNs, fonts or scripts, no analytics or telemetry.
- Never log, store or write to a file tokens (for example `mediaJwtToken`), user `emailAddress` or other personal data. No `console` calls in UI code.
- No `delete:*` scopes and no delete calls unless this app's own sections allow them. Ask for the fewest scopes that work.
- `manifest.yml` is gitignored because it holds the app id. The committed copy is `manifest.yml.example` with `REPLACE_ME`: mirror every other manifest change there. Never commit `.env`; `.env.example` lists the variables.

### Dependencies

- Runtime dependencies: React, `react-dom`, `@forge/bridge`, `@atlaskit/tokens` and `fflate`; apps with resolvers add the `@forge/*` packages they need. Dev tooling: Vite, `@vitejs/plugin-react`, ESLint 9 (pinned major), Vitest. Ask before adding anything else. No UI component libraries in new apps.
- Use the Node version from `.nvmrc`.

### Code, docs and UI copy

- English for code, comments, docs and commit messages. Reply to the user in Ukrainian.
- Never use the em dash character anywhere: the check fails on it.
- Sentence case in the UI. The display name lives in one place in code (`src/appInfo.js` in new apps) and in the manifest.
- UI follows `../it-operations-forge-template/DESIGN.md`: read it before UI work and finish with its checklist (section 16). Plain HTML components and `var(--ds-...)` tokens with fallbacks, no hard-coded colors.

### Quality gate

- `npm run check` runs the rules in `scripts/check-rules.mjs`, lint, tests, the build and the bundle size check.
- Never disable a rule, skip a test or raise a limit just to get a green check: fix the cause or tell the user.
<!-- standards:end -->

## Commands

Two separate `package.json` files: the root (backend, tests) and `static/main` (UI).

```bash
npm run setup                                     # once after cloning: npm ci in both folders, enable the pre-commit hook
npm run check                                     # full gate: rules, lint, tests, build, bundle size
npm run check:fast                                # rules and lint (the pre-commit hook)
npm run lint                                      # root eslint, then static/main eslint
npm test                                          # vitest run (root test/ only)
npx vitest run test/normalize.test.js             # single test file
npx vitest run -t "name of test"                  # single test by name
npm run build                                     # builds static/main into static/main/build (the Forge resource)
forge lint                                        # needs forge login; the user runs it
```

The manifest serves `static/main/build`. `forge logs` also needs `forge login`.

## Backend (explicit exceptions to the shared defaults)

This app is not frontend only. It uses resolvers (`@forge/resolver`, `handler`), `@forge/api` (`asUser` and `route` only, no `asApp()`), Forge KVS (`@forge/kvs`) and two triggers: a product event trigger (`onIssueDeleted`) and a daily scheduled trigger (`onRetentionTick`). Deletes are limited to `kvs.batchDelete` in the retention job; there are no Jira delete calls.

## Architecture

Three entry points exported from `src/index.js` (names must match `handler:` in `manifest.yml`, and `test/index.test.js` enforces the export list): `onIssueDeleted` (product event trigger), `handler` (resolver for the Custom UI), `onRetentionTick` (daily scheduled trigger).

- **Write path:** `events/issueDeleted.js` -> `lib/normalize.js` (pure) -> `kvs.entity('deletion').set(issueId, record)`. Key = issue ID, so redelivery is idempotent. The trigger makes no Jira calls and no `asApp()` calls.
- **Read path:** UI `invoke()` -> `resolvers/index.js`. Every resolver is wrapped in `guarded()`, which runs `assertJiraAdmin()` (`mypermissions?permissions=ADMINISTER` as the user) before touching storage, validates input via `lib/filters.js`, and returns `{ ok, data }` or `{ ok: false, error: 'FORBIDDEN' | 'INVALID_INPUT' | 'INTERNAL' }`. The page is a `jira:adminPage` (shown only in Jira admin settings); the resolver check is the real gate.
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
- Never log record values (summary, account IDs); log counts and error messages only.
