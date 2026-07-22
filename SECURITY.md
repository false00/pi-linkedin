# Security Policy

## Supported versions

Only the latest published version is supported for security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories or by contacting the maintainer directly.

## Security posture

- This package is read-only against LinkedIn.
- It can reuse a user-supplied LinkedIn session cookie, but it does not automate account actions.
- Session cookies should be stored only in local config or environment variables and must never be committed.
- It does not attempt to bypass LinkedIn authentication or access controls.
- When the package follows an offsite apply URL to recover a description, it does not forward the LinkedIn cookie to the external host.
- Any rate limiting, markup breakage, or network restriction should be surfaced as an explicit tool failure.
