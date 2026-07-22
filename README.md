# @false00/pi-linkedin

[![CI](https://github.com/false00/pi-linkedin/actions/workflows/ci.yml/badge.svg)](https://github.com/false00/pi-linkedin/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/false00/pi-linkedin.svg)](LICENSE)

Production-focused LinkedIn job search for the Pi coding agent.

`@false00/pi-linkedin` exposes **2 Pi tools** and **1 slash command** for resume-driven LinkedIn job discovery, auth checks, and public job-detail extraction. It is designed to help `pi.dev` search LinkedIn jobs from a candidate resume with either LinkedIn's public guest pages or an optional authenticated session cookie.

| Resource | Link |
|---|---|
| npm | `@false00/pi-linkedin` |
| GitHub | [github.com/false00/pi-linkedin](https://github.com/false00/pi-linkedin) |
| License | [MIT](LICENSE) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Security policy | [SECURITY.md](SECURITY.md) |
| Compatibility notes | [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) |
| Examples | [docs/EXAMPLES.md](docs/EXAMPLES.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Contributing guide | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Why this package

This package exists for one specific Pi workflow: take a user resume, derive useful LinkedIn search terms, fetch public job results, and rank them into something `pi.dev` can use immediately.

What it emphasizes:

- **Resume-driven search** — derive titles and skills from a resume when the user does not provide an explicit query
- **No-login first run** — works against LinkedIn public guest job pages by default
- **Optional session reuse** — can send your own LinkedIn browser cookie when guest access is too limited
- **Agent-friendly scoring** — returns structured JSON with match scores, matched keywords, and optional detail-page enrichment
- **Compensation extraction** — detects explicit salary ranges in LinkedIn or offsite descriptions and returns them in structured detail payloads when present
- **Pi-native packaging** — dist-first runtime, smoke/runtime/package tests, docs, and CI in the same shape as the other `pi-*` Node packages
- **Operational honesty** — the package documents that it depends on LinkedIn public markup and may need maintenance if LinkedIn changes page structure

## Tool coverage

| Tool | Description |
|---|---|
| `linkedin_search_jobs` | Search LinkedIn's public jobs pages from a resume or explicit query, then rank and enrich results |
| `linkedin_get_job_details` | Fetch one public LinkedIn job page and return structured details, with optional resume fit scoring |

## Slash commands

| Command | Description |
|---|---|
| `/linkedin_auth` | Reload `~/.config/pi-linkedin/.env` and test whether the current LinkedIn cookie/session is working |

## Search model

The package follows a simple, explicit pipeline:

1. Parse the supplied resume for likely job titles and technology keywords.
2. Build a LinkedIn search query when the user did not provide one.
3. Fetch LinkedIn guest search result cards from the public jobs endpoint.
4. Rank results by title, skill overlap, requested location match, and recency.
5. Optionally fetch the public detail pages for the highest-ranked jobs and rescore them with richer description text.

This keeps the runtime lightweight while still giving `pi.dev` enough signal to filter bad matches.

When LinkedIn serves a logged-in app shell instead of the older public detail markup, the package falls back to the embedded rehydration payload for title/company/location. If LinkedIn only exposes an offsite apply URL for the description, the package may fetch that external job page to recover the body text. The LinkedIn cookie is only sent to LinkedIn hosts, not to external apply systems.

Both `linkedin_search_jobs` and `linkedin_get_job_details` now return an `access` object in their JSON payload so the caller can tell whether the result came from a guest session or an authenticated LinkedIn cookie-backed session.

When a job description explicitly includes compensation, the detail payload also returns a structured `compensation` object. Search results surface a condensed `compensationSummary` for enriched results.

## Stability guarantees

Current guarantees:

- published tool names are treated as stable once released
- the extension loads without credentials and auto-creates `~/.config/pi-linkedin/.env` on startup with recommended defaults
- tool output remains structured JSON with a stable top-level shape for search results and job details
- the package stays read-only against LinkedIn and does not attempt account actions
- public-markup breakage is treated as a compatibility issue and should be documented when detected

## Install

Install into Pi as a package:

```bash
pi install npm:@false00/pi-linkedin
```

Use it for a single run without changing your settings:

```bash
pi -e npm:@false00/pi-linkedin
```

For local development from this repository:

```bash
pi -e .
```

## Quick start

Ask Pi for a job search directly from a resume summary:

```text
Search LinkedIn jobs for this resume and show me the best backend roles in Austin
```

Or be explicit:

```text
Use linkedin_search_jobs with query "staff platform engineer kubernetes aws" and location "United States"
```

Then inspect the best match:

```text
Use linkedin_get_job_details on the top result and tell me why it fits the resume
```

After editing `~/.config/pi-linkedin/.env`, run:

```text
/linkedin_auth
```

That command reloads the current `.env` values without restarting Pi and checks whether LinkedIn accepts the current session cookie.

## Top tasks and example prompts

Common things users can ask Pi to do with this package:

```text
Search LinkedIn for jobs that fit this resume in Dallas
Show me the top 10 LinkedIn roles for this data engineer resume
Search LinkedIn for remote product manager jobs based on this resume summary
Fetch the public details for this LinkedIn job URL
Score this job against the user's resume and summarize the fit
Search LinkedIn for New York security roles that explicitly show salary ranges
```

## Trust, safety, and operating model

This is a **read-only public-web package**.

Important expectations:

- It uses **public LinkedIn job pages**, not a private LinkedIn API.
- It can optionally reuse a user-supplied LinkedIn session cookie, but it still does not perform login on your behalf.
- It does **not** log in, message recruiters, submit applications, or mutate account state.
- Search quality depends on the signal present in the resume text and on what LinkedIn exposes publicly.
- When the package is running in guest mode, tool results say so explicitly because LinkedIn may hide jobs, fields, or related metadata from unauthenticated sessions.
- When the package is running in guest mode, the tools also emit a warning-style note so the user can see the limitation without parsing the JSON payload.
- LinkedIn may rate-limit or change public HTML structure; those failures should surface as honest tool errors.
- The top search tool intentionally caps returned results and detail-page fetches to reduce load and keep output usable.

If you are evaluating the package for production use, review:

- [SECURITY.md](SECURITY.md)
- [AGENTS.md](AGENTS.md)
- [CHANGELOG.md](CHANGELOG.md)
- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)
- [tests/](tests/) for behavioral coverage

## Configuration

### Requirements

- Node.js 22+
- A Pi runtime with extension support
- Network access to `www.linkedin.com`

### Settings

Create or update `~/.config/pi-linkedin/.env`:

```env
LINKEDIN_BASE_URL=https://www.linkedin.com
LINKEDIN_DEFAULT_LOCATION=United States
LINKEDIN_DEFAULT_LIMIT=10
LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30
LINKEDIN_DEFAULT_INCLUDE_DETAILS=true
LINKEDIN_TIMEOUT_MS=45000
LINKEDIN_ACCEPT_LANGUAGE=en-US,en;q=0.9
LINKEDIN_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
LINKEDIN_LI_AT=
LINKEDIN_COOKIE=
```

Values in `~/.config/pi-linkedin/.env` take precedence over process environment variables.

Those defaults are intentionally opinionated for first-run success: broad US coverage, recent postings, enriched top matches, a realistic browser user-agent, and a longer timeout for public LinkedIn pages.

### Authenticated cookie options

If you need authenticated LinkedIn access, do **not** paste cookies into chat. Edit `~/.config/pi-linkedin/.env` locally and use one of these:

- `LINKEDIN_LI_AT`: the raw value of your browser's `li_at` cookie, without the `li_at=` prefix
- `LINKEDIN_COOKIE`: the full `Cookie` header string when you need to mirror multiple browser cookies

Recommended starting point:

```env
LINKEDIN_LI_AT=your-full-li_at-cookie-value
```

If LinkedIn requires the full browser session instead, use:

```env
LINKEDIN_COOKIE=li_at=your-full-li_at-cookie-value; JSESSIONID="ajax:123456789"; lang=v=2&lang=en-us
```

In practice, the value you usually want first is the `li_at` cookie. Copy its full value from your logged-in browser session exactly as stored, with no extra escaping beyond normal `.env` quoting if needed.

Chrome or Edge:

1. Open `https://www.linkedin.com` while logged in.
2. Press `F12`.
3. Open `Application` -> `Storage` -> `Cookies` -> `https://www.linkedin.com`.
4. Copy the `li_at` value into `~/.config/pi-linkedin/.env` as `LINKEDIN_LI_AT=...`.

Firefox:

1. Open `https://www.linkedin.com` while logged in.
2. Press `F12`.
3. Open `Storage` -> `Cookies` -> `https://www.linkedin.com`.
4. Copy the `li_at` value into `~/.config/pi-linkedin/.env` as `LINKEDIN_LI_AT=...`.

If `li_at` alone is not enough, use the browser network inspector and copy the full request `Cookie` header value into `LINKEDIN_COOKIE` in `~/.config/pi-linkedin/.env`.

If LinkedIn rejects the session with `401`, `403`, or an auth wall, refresh `LINKEDIN_LI_AT` or `LINKEDIN_COOKIE` in `~/.config/pi-linkedin/.env` from a current logged-in browser session and retry.

After changing either value, run `/linkedin_auth` to reload the file and test the new cookie immediately.

## Compatibility

The package currently depends on LinkedIn's public jobs search markup and public job detail pages as observed on 2026-07-21.

If LinkedIn changes selectors such as `base-search-card__title`, `base-card__full-link`, `topcard__title`, or `show-more-less-html__markup`, search and detail extraction may degrade until the package is updated.

If LinkedIn tightens guest access, authenticated cookie reuse may become necessary for some searches.

See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) for current assumptions.

## Repository layout

- `dist/` — committed runtime source of truth
- `dist/index.js` — Pi extension entrypoint
- `dist/linkedin-client.js` — public fetch, parsing, ranking, and config handling
- `dist/tools/` — Pi tool definitions
- `docs/` — operator documentation
- `tests/` — smoke, runtime, and package tests
- `.github/` — CI, code scanning, and issue templates

## Development

Run the local verification suite:

```bash
npm test
```

Fast checks:

```bash
npm run test:smoke
npm run test:runtime
npm run test:package
```

Before publish, also run:

```bash
npm pack --dry-run
```
