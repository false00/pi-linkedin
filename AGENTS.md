# `@false00/pi-linkedin` maintainer guide

This file is the operating manual for agents and maintainers working on `@false00/pi-linkedin`.

## Mission

Keep this package reliable, honest, and operationally useful for resume-driven LinkedIn job discovery.

The package exists to give the Pi coding agent a lightweight way to search LinkedIn's public jobs pages, rank results against a resume, and inspect job details without browser setup or private API dependencies.

## Repository map

- `dist/` — source of truth for runtime code; there is no separate `src/` tree
- `dist/index.js` — default-exported Pi extension entrypoint
- `dist/linkedin-client.js` — config loading, public fetch helpers, HTML parsing, and match scoring
- `dist/tool-runtime.js` — shared execution helpers and tool-error shaping
- `dist/tools/` — Pi tool definitions
- `docs/` — compatibility notes, examples, and troubleshooting
- `tests/` — smoke, runtime, and package tests
- `.github/` — CI workflows, templates, and dependency review

## Project facts

- The project is **pure JavaScript**.
- `dist/` is **committed directly**.
- There is **no build step** and no `tsconfig.json`.
- The package is intended for **Pi package installation via npm**.
- The entrypoint must remain registered in `package.json` under `pi.extensions`.
- The package currently exposes `linkedin_search_jobs` and `linkedin_get_job_details`.
- The package also exposes the `/linkedin_auth` command for config reload and auth probing.
- The supported Node.js floor is **22+**.

## Pi package conventions

Follow current Pi package guidance:

- Keep the `pi-package` keyword in `package.json`.
- Preserve `pi.extensions` so Pi can load the package root directly.
- Tool failures must be **thrown** from `execute()` so Pi surfaces them as real tool errors.
- Keep tool names stable and prefixed with `linkedin_`.
- Return structured JSON text plus a `details` payload so Pi can reason over search results.
- Prefer explicit, small helper functions over clever abstractions.

## Runtime guarantees

Maintain these behavioral guarantees:

- The extension should load without credentials.
- `~/.config/pi-linkedin/.env` should be created automatically when missing.
- The package stays read-only and should never automate account state changes.
- The package may reuse a user-provided LinkedIn cookie header or `li_at` value, but it must never prompt for or log secrets.
- Search and details tools should surface rate limits, markup breakage, and network failures as honest tool errors.
- Search results should include canonical URLs, match scores, and matched keyword summaries.
- Search results should include structured compensation summaries when the source explicitly publishes salary ranges.
- `/linkedin_auth` should reload `~/.config/pi-linkedin/.env` and report whether the current cookie configuration works.

## Documentation policy

Documentation must match code.

Whenever you change a tool parameter, output shape, query heuristic, config behavior, or compatibility assumption, update all affected docs:

1. the tool `description` in `dist/tools/*.js`
2. `README.md`
3. `AGENTS.md` if maintainer expectations changed
4. `CONTRIBUTING.md` or `SECURITY.md` if contributor or trust processes changed
5. the relevant docs under `docs/`

Before finishing, grep for stale references to:

- old tool names
- old config keys
- outdated selector names
- unsupported LinkedIn behavior claims

## Testing policy

Every code change should be backed by tests appropriate to the behavior being touched.

Current suites:

- `tests/smoke.test.mjs` — extension import, tool-surface checks, and fresh-install config template behavior
- `tests/runtime.test.mjs` — resume parsing, search ranking, and detail extraction with mocked LinkedIn HTML
- `tests/package.test.mjs` — metadata, published files, docs, and repository automation checks

Expectations:

- Run `npm test` before considering work complete.
- Run `npm run test:runtime` when touching parsing, scoring, or response shape.
- Keep mocked HTML fixtures close to the selectors the runtime depends on.
- When LinkedIn markup changes, add or update tests before changing the parser.

## Security and trust posture

Treat this package as external-web automation software, not a toy demo.

- Do not weaken rate-limit, timeout, or failure reporting for convenience.
- Do not log secrets in code, tests, or docs.
- Do not claim official API support; this package uses public guest pages only.
- If behavior is uncertain, inspect live markup or tests instead of guessing.

## Release discipline

- Never commit without explicit user approval.
- Never push or publish without explicit user approval.
- Do not skip npm versions.
- Dry-run with `npm pack --dry-run` before publish.
- Publish with `npm publish --ignore-scripts`.
- If npm requires browser auth / 2FA / OTP, stop and ask the user to complete the publish manually.

## Release checklist

1. Run `npm test`
2. Run `npm run test:smoke`
3. Run `npm run test:runtime`
4. Run `npm run test:package`
5. Run `npm pack --dry-run`
6. Verify `package.json` metadata is current
7. Verify README and AGENTS reflect shipped behavior
8. Check whether the current version is already published before bumping
9. Verify GitHub workflows still reflect the intended trust and security posture
10. Only commit, tag, push, or publish with explicit user approval
