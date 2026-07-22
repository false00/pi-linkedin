# Troubleshooting

## No jobs returned

- Check whether the derived query is too narrow.
- Retry with an explicit `query` and broader `location`.
- Remove `posted_within_days` if you applied a tight recency filter.
- Check the generated `~/.config/pi-linkedin/.env`; by default it uses `United States`, `30` days, and detail enrichment.
- If the result payload says `access.mode` is `guest`, remember that LinkedIn may be hiding some jobs or metadata until you provide a cookie.
- The tools also emit a `LINKEDIN GUEST MODE` warning when this happens so the limitation is visible even outside the JSON result body.
- That warning now points directly at `~/.config/pi-linkedin/.env` and tells the user to rerun `/linkedin_auth` after updating the cookie.

## Compensation is missing

- The package only reports compensation when the job description or offsite apply page explicitly includes it.
- Many LinkedIn jobs still do not publish salary information, even for authenticated sessions.
- When compensation is present, `linkedin_get_job_details` returns a structured `compensation` object and enriched search results include `details.compensationSummary`.

## LinkedIn request timed out or failed

- Confirm the machine can reach `www.linkedin.com`.
- Increase `LINKEDIN_TIMEOUT_MS` if the network is slow.
- Retry later if LinkedIn is rate-limiting public requests.
- If guest requests are blocked, add `LINKEDIN_LI_AT` or `LINKEDIN_COOKIE` to `~/.config/pi-linkedin/.env`.
- After updating the cookie settings, run `/linkedin_auth` to reload the file and verify the current session.

## LinkedIn says auth is required or the cookie stopped working

- If the tool reports `401` or says the configured session cookie was rejected, refresh `LINKEDIN_LI_AT` or `LINKEDIN_COOKIE` in `~/.config/pi-linkedin/.env` from a current logged-in browser session.
- If the tool reports `403` for a guest request, add `LINKEDIN_LI_AT` first.
- If `LINKEDIN_LI_AT` alone still fails, replace it with `LINKEDIN_COOKIE` using the full browser `Cookie` header string.
- After updating the `.env`, rerun the LinkedIn tool so it picks up the new values in a fresh session.
- Prefer `/linkedin_auth` after any cookie change so you can test the reload before running a full search.

### Chrome or Edge

1. Open `https://www.linkedin.com` while logged in.
2. Press `F12`.
3. Open `Application` -> `Storage` -> `Cookies` -> `https://www.linkedin.com`.
4. Copy the `li_at` cookie value into `~/.config/pi-linkedin/.env` as `LINKEDIN_LI_AT=...`.

### Firefox

1. Open `https://www.linkedin.com` while logged in.
2. Press `F12`.
3. Open `Storage` -> `Cookies` -> `https://www.linkedin.com`.
4. Copy the `li_at` cookie value into `~/.config/pi-linkedin/.env` as `LINKEDIN_LI_AT=...`.

If `li_at` alone still does not work, copy the full request `Cookie` header from the browser network inspector into `LINKEDIN_COOKIE`.

## How do I know whether the result was guest-limited?

- `linkedin_search_jobs` and `linkedin_get_job_details` return an `access` object.
- If `access.mode` is `guest`, LinkedIn may be hiding some results, descriptions, or related metadata.
- If `access.mode` is `authenticated`, the package is using your configured cookie-backed LinkedIn session.

## Which cookie value should I use?

- Start with `LINKEDIN_LI_AT`.
- Use the raw `li_at` cookie value from your logged-in browser session, without the `li_at=` prefix.
- Only use `LINKEDIN_COOKIE` when LinkedIn requires the full cookie header string.

## Search parsing suddenly degrades

- Inspect the current public LinkedIn markup.
- Compare it to the selectors documented in [COMPATIBILITY.md](COMPATIBILITY.md).
- Update tests first, then adjust the parser.
