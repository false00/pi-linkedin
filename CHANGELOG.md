# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 0.1.3 - 2026-08-13

- Replaced Cheerio with the smaller HTML parser stack used for the package's existing CSS selectors, removing the vulnerable Cheerio-to-Undici dependency path from installed extensions.
- Restored the broad Pi coding-agent peer range and added the supported Pi runtime as a direct dependency so this extension can coexist with other Pi packages that declare different peer ranges.
- Added a CI gate that fails when the production dependency tree has known npm audit findings.

## 0.1.2 - 2026-08-13

- Raised the Pi coding-agent peer dependency floor to `0.84.1` and refreshed locked transitive dependencies to address Dependabot advisories.
- Updated GitHub Actions dependencies: checkout v7, setup-node v7, CodeQL v4, and dependency-review v5.

## 0.1.1 - 2026-07-21

- Added optional LinkedIn session-cookie support through `LINKEDIN_LI_AT` or `LINKEDIN_COOKIE`.
- Made startup `.env` creation explicit and upgraded the generated defaults for first-run searches.
- Added explicit runtime guidance for `401`, `403`, and auth-wall responses so users know when to add or refresh LinkedIn cookies.
- Added `/linkedin_auth` to reload `.env` and verify the current LinkedIn cookie/session immediately.
- Added explicit `access` result metadata and guest-mode warnings so users know when LinkedIn may be hiding unauthenticated results.
- Guest-mode searches and detail reads now emit warning-style UI notes so the limitation stands out visually.
- Guest-mode warnings now point directly at `~/.config/pi-linkedin/.env`, and the generated `.env` template now includes Chrome/Edge and Firefox cookie-copy instructions.
- Added a fallback for authenticated LinkedIn app-shell job pages that uses embedded rehydration data and offsite apply pages to recover missing details without forwarding the LinkedIn cookie to external hosts.
- Added structured compensation extraction for explicit salary ranges and exposed compensation summaries in enriched search results.

## 0.1.0 - 2026-07-21

- Added a dist-first Pi package structure aligned with the existing `pi-*` Node repositories.
- Added `linkedin_search_jobs` for resume-driven LinkedIn public job search and ranking.
- Added `linkedin_get_job_details` for structured public job-detail extraction and optional resume fit scoring.
- Added smoke, runtime, and package tests.
- Added CI, dependency-review, and repository trust documentation.
