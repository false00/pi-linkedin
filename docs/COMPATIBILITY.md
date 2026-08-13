# Compatibility

`@false00/pi-linkedin` currently targets:

- Node.js 22.19+
- Pi runtimes with `@earendil-works/pi-coding-agent` 0.84.1+ that support package extensions and `registerTool`
- LinkedIn public guest search pages reachable at `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search`
- Optional authenticated LinkedIn web-session cookie reuse through `LINKEDIN_LI_AT` or `LINKEDIN_COOKIE`
- LinkedIn public job detail pages that still expose selectors such as:
  - `base-search-card__title`
  - `base-card__full-link`
  - `job-search-card__location`
  - `topcard__title`
  - `topcard__org-name-link`
  - `show-more-less-html__markup`

If LinkedIn changes those selectors or requires authentication for guest pages, the package will need an update.
