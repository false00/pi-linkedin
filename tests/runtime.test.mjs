import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildResumeProfile, buildSearchUrl, extractCompensationInfo, getLinkedInAuthCommand, LinkedInClient } from "../dist/linkedin-client.js";
import { getJobDetailsTool } from "../dist/tools/job-details.js";
import { searchJobsTool } from "../dist/tools/search-jobs.js";
import { withTempLinkedInConfig } from "./helpers.mjs";

function createMockFetch(responses) {
  return async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    const parsed = new URL(url);
    const normalized = `${parsed.origin}${parsed.pathname}`;
    const body = responses.get(url)
      || responses.get(normalized)
      || (normalized.endsWith("/jobs-guest/jobs/api/seeMoreJobPostings/search") ? responses.get("SEARCH") : undefined);
    if (!body) {
      return new Response("not found", { status: 404 });
    }
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  };
}

function createHeaderCapturingFetch(responses, capturedHeaders) {
  return async (input, init = {}) => {
    capturedHeaders.push(init.headers ?? {});
    return await createMockFetch(responses)(input, init);
  };
}

function createRequestCapturingFetch(responses, capturedRequests) {
  return async (input, init = {}) => {
    capturedRequests.push({
      url: typeof input === "string" ? input : input.toString(),
      headers: init.headers ?? {},
    });
    return await createMockFetch(responses)(input, init);
  };
}

function createStatusFetch(status, url = "https://www.linkedin.com/jobs/view/101") {
  return async () => new Response("blocked", {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function createAuthWallFetch() {
  return async () => new Response("<html><body>authwall</body></html>", {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function createFeedSuccessFetch(capturedHeaders = []) {
  return async (_input, init = {}) => {
    capturedHeaders.push(init.headers ?? {});
    return {
      ok: true,
      status: 200,
      url: "https://www.linkedin.com/feed/",
      async text() {
        return "<html><title>LinkedIn Feed</title><body>feed</body></html>";
      },
    };
  };
}

const SEARCH_HTML = `
  <li>
    <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:101">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/backend-engineer-101?trackingId=abc"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">Backend Engineer</h3>
        <h4 class="base-search-card__subtitle"><a class="hidden-nested-link">Acme</a></h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">Austin, TX</span>
          <time class="job-search-card__listdate" datetime="2026-07-20">1 day ago</time>
        </div>
      </div>
    </div>
  </li>
  <li>
    <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:202">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/product-designer-202?trackingId=def"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">Product Designer</h3>
        <h4 class="base-search-card__subtitle"><a class="hidden-nested-link">Example Studio</a></h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">Remote</span>
          <time class="job-search-card__listdate" datetime="2026-06-28">3 weeks ago</time>
        </div>
      </div>
    </div>
  </li>
`;

const BACKEND_DETAIL_HTML = `
  <html>
    <head>
      <link rel="canonical" href="https://www.linkedin.com/jobs/view/backend-engineer-101" />
    </head>
    <body>
      <h1 class="topcard__title">Backend Engineer</h1>
      <a class="topcard__org-name-link">Acme</a>
      <span class="topcard__flavor topcard__flavor--bullet">Austin, TX</span>
      <span class="posted-time-ago__text topcard__flavor--metadata">1 day ago</span>
      <ul class="description__job-criteria-list">
        <li class="description__job-criteria-item">
          <h3 class="description__job-criteria-subheader">Seniority level</h3>
          <span class="description__job-criteria-text description__job-criteria-text--criteria">Mid-Senior level</span>
        </li>
        <li class="description__job-criteria-item">
          <h3 class="description__job-criteria-subheader">Employment type</h3>
          <span class="description__job-criteria-text description__job-criteria-text--criteria">Full-time</span>
        </li>
      </ul>
      <div class="show-more-less-html__markup">Build Node.js and TypeScript services on AWS with PostgreSQL.</div>
    </body>
  </html>
`;

const DESIGN_DETAIL_HTML = `
  <html>
    <head>
      <link rel="canonical" href="https://www.linkedin.com/jobs/view/product-designer-202" />
    </head>
    <body>
      <h1 class="topcard__title">Product Designer</h1>
      <a class="topcard__org-name-link">Example Studio</a>
      <span class="topcard__flavor topcard__flavor--bullet">Remote</span>
      <span class="posted-time-ago__text topcard__flavor--metadata">3 weeks ago</span>
      <ul class="description__job-criteria-list">
        <li class="description__job-criteria-item">
          <h3 class="description__job-criteria-subheader">Employment type</h3>
          <span class="description__job-criteria-text description__job-criteria-text--criteria">Contract</span>
        </li>
      </ul>
      <div class="show-more-less-html__markup">Design consumer mobile flows in Figma.</div>
    </body>
  </html>
`;

const AUTH_LINKEDIN_SHELL_HTML = `
  <html>
    <head>
      <title>Senior DevSecOps Engineer | PactFi | LinkedIn</title>
    </head>
    <body>
      <script id="rehydrate-data" type="text/javascript">
        window.__como_rehydration__ = [
          "{\\\"payload\\\":{\\\"jobId\\\":\\\"4440834442\\\",\\\"companyName\\\":\\\"PactFi\\\",\\\"offsiteApplyUrl\\\":\\\"https://jobs.example.com/pactfi/senior-devsecops-engineer\\\",\\\"jobTitle\\\":\\\"Senior DevSecOps Engineer\\\"}}",
          "{\\\"children\\\":[\\\"Senior DevSecOps Engineer\\\"]}",
          "{\\\"children\\\":[\\\"PactFi • New York, NY (Hybrid)\\\"]}"
        ];
      </script>
    </body>
  </html>
`;

const AUTH_OFFSITE_HTML = `
  <html>
    <head>
      <title>Senior DevSecOps Engineer @ PactFi</title>
      <meta name="description" content="About PactFi Build bank-grade private credit infrastructure on AWS and Kubernetes. Base salary range: $190,000 - $240,000 annually. Responsibilities include security automation, threat monitoring, and secure SDLC practices." />
    </head>
    <body>
      <main>
        <article>
          <h1>Senior DevSecOps Engineer</h1>
          <p>About PactFi</p>
          <p>Build bank-grade private credit infrastructure on AWS and Kubernetes.</p>
          <p>Base salary range: $190,000 - $240,000 annually.</p>
          <p>Responsibilities include security automation, threat monitoring, secure SDLC practices, and platform hardening.</p>
        </article>
      </main>
    </body>
  </html>
`;

function createClient() {
  const baseUrl = "https://www.linkedin.com";

  const responses = new Map([
    ["SEARCH", SEARCH_HTML],
    [buildSearchUrl({
      baseUrl,
      query: "backend engineer node.js typescript aws",
      location: "Austin, TX",
      start: 0,
      postedWithinDays: undefined,
    }), SEARCH_HTML],
    ["https://www.linkedin.com/jobs/view/backend-engineer-101", BACKEND_DETAIL_HTML],
    ["https://www.linkedin.com/jobs/view/101", BACKEND_DETAIL_HTML],
    ["https://www.linkedin.com/jobs/view/product-designer-202", DESIGN_DETAIL_HTML],
  ]);

  return new LinkedInClient({
    fetchImpl: createMockFetch(responses),
    config: {
      baseUrl,
      defaultLocation: undefined,
      defaultLimit: 10,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
    },
  });
}

test("resume profiling derives LinkedIn-friendly titles and keywords", () => {
  const profile = buildResumeProfile(
    "Senior Backend Engineer\nBuilt Node.js and TypeScript APIs on AWS with PostgreSQL and Docker.",
    "",
  );

  assert.ok(profile.titles.includes("backend engineer"));
  assert.ok(profile.skills.includes("node.js"));
  assert.ok(profile.skills.includes("typescript"));
  assert.ok(profile.suggestedQuery.includes("backend engineer"));
});

test("linkedin_search_jobs ranks public results against the supplied resume", async () => {
  const client = createClient();
  const tool = searchJobsTool(client);
  const notices = [];
  const result = await tool.execute("call-1", {
    resume_text: "Senior Backend Engineer\nBuilt Node.js and TypeScript APIs on AWS with PostgreSQL.",
    location: "Austin, TX",
    limit: 2,
    include_details: true,
  }, undefined, async () => {}, {
    ui: {
      notify(message, level) {
        notices.push({ message, level });
      },
    },
  });

  const payload = result.details;
  assert.equal(payload.resultCount, 2);
  assert.equal(payload.access.mode, "guest");
  assert.equal(payload.access.authenticated, false);
  assert.match(payload.summary, /Guest access is active/);
  assert.equal(notices[0].level, "warning");
  assert.match(notices[0].message, /LINKEDIN GUEST MODE/);
  assert.match(notices[0].message, /~\/\.config\/pi-linkedin\/\.env/);
  assert.match(notices[0].message, /rerun \/linkedin_auth/);
  assert.equal(payload.results[0].jobId, "101");
  assert.equal(payload.results[0].company, "Acme");
  assert.equal(payload.results[0].details.criteria["Employment type"], "Full-time");
  assert.ok(payload.results[0].matchedKeywords.includes("node.js"));
  assert.ok(payload.results[0].matchScore > payload.results[1].matchScore);
});

test("linkedin_get_job_details returns structured criteria and optional fit scoring", async () => {
  const client = createClient();
  const tool = getJobDetailsTool(client);
  const result = await tool.execute("call-2", {
    job_id: "101",
    resume_text: "Backend Engineer\nNode.js, TypeScript, AWS, PostgreSQL",
  }, undefined, async () => {}, {});

  const payload = result.details;
  assert.equal(payload.access.mode, "guest");
  assert.equal(payload.access.authenticated, false);
  assert.match(payload.summary, /Guest access is active/);
  assert.equal(payload.job.jobId, "101");
  assert.equal(payload.job.company, "Acme");
  assert.equal(payload.job.criteria["Seniority level"], "Mid-Senior level");
  assert.equal(payload.job.compensation.hasCompensation, false);
  assert.ok(payload.matchedKeywords.includes("backend engineer"));
  assert.ok(payload.matchScore > 0);
});

test("extractCompensationInfo captures real salary ranges and ignores funding figures", () => {
  const salaryText = "Employment Type: Full Time, Exempt Base Compensation: The base compensation range for this position is: - Hybrid Commitment: $217,000–$288,000 USD Annually - Fully Remote Commitment: $182,000- $240,000 USD Annually.";
  const parsed = extractCompensationInfo(salaryText);

  assert.equal(parsed.hasCompensation, true);
  assert.equal(parsed.ranges.length, 2);
  assert.equal(parsed.ranges[0].label, "Hybrid Commitment");
  assert.equal(parsed.ranges[0].min, 217000);
  assert.equal(parsed.ranges[0].max, 288000);
  assert.equal(parsed.ranges[0].interval, "year");
  assert.equal(parsed.ranges[1].label, "Fully Remote Commitment");
  assert.equal(parsed.ranges[1].min, 182000);
  assert.equal(parsed.ranges[1].max, 240000);
  assert.match(parsed.summary, /Hybrid Commitment: \$217,000–\$288,000/);

  const falsePositiveText = "Private markets are projected to grow to $17T in the next five years. We have raised more than $328M in funding.";
  const falsePositive = extractCompensationInfo(falsePositiveText);
  assert.equal(falsePositive.hasCompensation, false);
  assert.equal(falsePositive.ranges.length, 0);
});

test("configured LinkedIn cookie is forwarded on outbound requests", async () => {
  const baseUrl = "https://www.linkedin.com";
  const responses = new Map([
    ["https://www.linkedin.com/jobs/view/101", BACKEND_DETAIL_HTML],
  ]);
  const capturedHeaders = [];
  const client = new LinkedInClient({
    fetchImpl: createHeaderCapturingFetch(responses, capturedHeaders),
    config: {
      baseUrl,
      defaultLocation: undefined,
      defaultLimit: 10,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
      cookieHeader: "li_at=linkedin-session-cookie",
    },
  });

  await client.getJobDetails({ jobId: "101" }, undefined, async () => {});

  assert.equal(capturedHeaders.length, 1);
  assert.equal(capturedHeaders[0].cookie, "li_at=linkedin-session-cookie");
});

test("search uses startup defaults when optional parameters are omitted", async () => {
  const baseUrl = "https://www.linkedin.com";
  const responses = new Map([
    ["SEARCH", SEARCH_HTML],
  ]);
  const capturedRequests = [];
  const client = new LinkedInClient({
    fetchImpl: createRequestCapturingFetch(responses, capturedRequests),
    config: {
      baseUrl,
      defaultLocation: "United States",
      defaultLimit: 10,
      defaultPostedWithinDays: 30,
      defaultIncludeDetails: false,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
    },
  });

  const result = await client.searchJobs({
    resumeText: "Backend Engineer\nNode.js TypeScript AWS",
  }, undefined, async () => {});

  assert.equal(result.location, "United States");
  assert.equal(result.postedWithinDays, 30);
  assert.equal(result.includeDetails, false);
  assert.equal(capturedRequests.length, 1);
  assert.match(capturedRequests[0].url, /location=United\+States/);
  assert.match(capturedRequests[0].url, /f_TPR=r2592000/);
});

test("guest auth failures tell the user to add a LinkedIn cookie", async () => {
  const client = new LinkedInClient({
    fetchImpl: createStatusFetch(403),
    config: {
      baseUrl: "https://www.linkedin.com",
      defaultLocation: "United States",
      defaultLimit: 10,
      defaultPostedWithinDays: 30,
      defaultIncludeDetails: true,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
    },
  });

  await assert.rejects(
    () => client.getJobDetails({ jobId: "101" }, undefined, async () => {}),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.category, "authorization");
      assert.match(error.guidance, /Add LINKEDIN_LI_AT or LINKEDIN_COOKIE/);
      return true;
    },
  );
});

test("configured-cookie auth failures tell the user to refresh the cookie", async () => {
  const client = new LinkedInClient({
    fetchImpl: createStatusFetch(401),
    config: {
      baseUrl: "https://www.linkedin.com",
      defaultLocation: "United States",
      defaultLimit: 10,
      defaultPostedWithinDays: 30,
      defaultIncludeDetails: true,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
      cookieHeader: "li_at=expired-cookie",
    },
  });

  await assert.rejects(
    () => client.getJobDetails({ jobId: "101" }, undefined, async () => {}),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.category, "authentication");
      assert.match(error.guidance, /Refresh LINKEDIN_LI_AT or LINKEDIN_COOKIE/);
      return true;
    },
  );
});

test("auth-wall redirects tell the user to refresh the cookie", async () => {
  const client = new LinkedInClient({
    fetchImpl: createAuthWallFetch(),
    config: {
      baseUrl: "https://www.linkedin.com",
      defaultLocation: "United States",
      defaultLimit: 10,
      defaultPostedWithinDays: 30,
      defaultIncludeDetails: true,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
      cookieHeader: "li_at=expired-cookie",
    },
  });

  await assert.rejects(
    () => client.fetchText("https://www.linkedin.com/jobs/view/101"),
    (error) => {
      assert.equal(error.status, 401);
      assert.match(error.guidance, /Refresh LINKEDIN_LI_AT or LINKEDIN_COOKIE/);
      return true;
    },
  );
});

test("reloadConfig re-reads updated cookie values from .env", async () => {
  await withTempLinkedInConfig(async ({ envPath }) => {
    await fs.writeFile(envPath, [
      "LINKEDIN_BASE_URL=https://www.linkedin.com",
      "LINKEDIN_DEFAULT_LOCATION=United States",
      "LINKEDIN_DEFAULT_LIMIT=10",
      "LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30",
      "LINKEDIN_DEFAULT_INCLUDE_DETAILS=true",
      "LINKEDIN_TIMEOUT_MS=45000",
      "LINKEDIN_ACCEPT_LANGUAGE=en-US,en;q=0.9",
      "LINKEDIN_USER_AGENT=test-agent",
      "",
    ].join("\n"), "utf8");

    const client = new LinkedInClient({
      fetchImpl: createFeedSuccessFetch(),
    });
    assert.equal(client.config.cookieHeader, undefined);
    assert.equal(client.config.cookieSource, "none");

    await fs.writeFile(envPath, [
      "LINKEDIN_BASE_URL=https://www.linkedin.com",
      "LINKEDIN_DEFAULT_LOCATION=United States",
      "LINKEDIN_DEFAULT_LIMIT=10",
      "LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30",
      "LINKEDIN_DEFAULT_INCLUDE_DETAILS=true",
      "LINKEDIN_TIMEOUT_MS=45000",
      "LINKEDIN_ACCEPT_LANGUAGE=en-US,en;q=0.9",
      "LINKEDIN_USER_AGENT=test-agent",
      "LINKEDIN_LI_AT=second-cookie",
      "",
    ].join("\n"), "utf8");

    const reload = client.reloadConfig();
    assert.equal(client.config.cookieHeader, "li_at=second-cookie");
    assert.equal(client.config.cookieSource, "li_at");
    assert.equal(reload.cookieConfigured, true);
    assert.equal(reload.cookieSource, "li_at");
    assert.equal(reload.accessMode, "authenticated");
  });
});

test("linkedin_auth command reloads config and reports success", async () => {
  await withTempLinkedInConfig(async ({ envPath }) => {
    await fs.writeFile(envPath, [
      "LINKEDIN_BASE_URL=https://www.linkedin.com",
      "LINKEDIN_DEFAULT_LOCATION=United States",
      "LINKEDIN_DEFAULT_LIMIT=10",
      "LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30",
      "LINKEDIN_DEFAULT_INCLUDE_DETAILS=true",
      "LINKEDIN_TIMEOUT_MS=45000",
      "LINKEDIN_ACCEPT_LANGUAGE=en-US,en;q=0.9",
      "LINKEDIN_USER_AGENT=test-agent",
      "LINKEDIN_LI_AT=reloaded-cookie",
      "",
    ].join("\n"), "utf8");

    const capturedHeaders = [];
    const client = new LinkedInClient({
      fetchImpl: createFeedSuccessFetch(capturedHeaders),
    });
    const command = getLinkedInAuthCommand(client);
    const notices = [];

    const result = await command.handler([], {
      ui: {
        notify(message, level) {
          notices.push({ message, level });
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.authenticated, true);
    assert.equal(result.cookieSource, "li_at");
    assert.equal(capturedHeaders[0].cookie, "li_at=reloaded-cookie");
    assert.equal(notices[0].level, "success");
    assert.match(notices[0].message, /LINKEDIN AUTH OK:/);
    assert.match(notices[0].message, /LI_AT cookie/);
  });
});

test("authenticated search reports that full LinkedIn session access is active", async () => {
  const baseUrl = "https://www.linkedin.com";
  const responses = new Map([
    ["SEARCH", SEARCH_HTML],
    ["https://www.linkedin.com/jobs/view/backend-engineer-101", BACKEND_DETAIL_HTML],
    ["https://www.linkedin.com/jobs/view/product-designer-202", DESIGN_DETAIL_HTML],
  ]);
  const client = new LinkedInClient({
    fetchImpl: createMockFetch(responses),
    config: {
      baseUrl,
      defaultLocation: "Austin, TX",
      defaultLimit: 10,
      defaultPostedWithinDays: 30,
      defaultIncludeDetails: true,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
      cookieHeader: "li_at=live-cookie",
      cookieSource: "li_at",
    },
  });
  const notices = [];

  const tool = searchJobsTool(client);
  const wrapped = await tool.execute("call-auth", {
    query: "backend engineer",
    location: "Austin, TX",
    limit: 1,
  }, undefined, async () => {}, {
    ui: {
      notify(message, level) {
        notices.push({ message, level });
      },
    },
  });
  const result = wrapped.details;

  assert.equal(result.access.mode, "authenticated");
  assert.equal(result.access.authenticated, true);
  assert.match(result.summary, /Authenticated LinkedIn access is active/);
  assert.equal(notices.length, 0);
});

test("linkedin_auth command reports refresh guidance for stale cookies", async () => {
  await withTempLinkedInConfig(async ({ envPath }) => {
    await fs.writeFile(envPath, [
      "LINKEDIN_BASE_URL=https://www.linkedin.com",
      "LINKEDIN_DEFAULT_LOCATION=United States",
      "LINKEDIN_DEFAULT_LIMIT=10",
      "LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30",
      "LINKEDIN_DEFAULT_INCLUDE_DETAILS=true",
      "LINKEDIN_TIMEOUT_MS=45000",
      "LINKEDIN_ACCEPT_LANGUAGE=en-US,en;q=0.9",
      "LINKEDIN_USER_AGENT=test-agent",
      "LINKEDIN_LI_AT=expired-cookie",
      "",
    ].join("\n"), "utf8");

    const client = new LinkedInClient({
      fetchImpl: createStatusFetch(401),
    });
    const command = getLinkedInAuthCommand(client);
    const notices = [];

    const result = await command.handler([], {
      ui: {
        notify(message, level) {
          notices.push({ message, level });
        },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.category, "authentication");
    assert.equal(result.cookieSource, "li_at");
    assert.match(result.summary, /Refresh LINKEDIN_LI_AT or LINKEDIN_COOKIE/);
    assert.equal(notices[0].level, "warning");
  });
});

test("authenticated LinkedIn shell pages fall back to rehydration data and offsite descriptions without leaking cookies", async () => {
  const linkedinUrl = "https://www.linkedin.com/jobs/view/senior-devsecops-engineer-at-pactfi-4440834442";
  const offsiteUrl = "https://jobs.example.com/pactfi/senior-devsecops-engineer";
  const responses = new Map([
    [linkedinUrl, AUTH_LINKEDIN_SHELL_HTML],
    [offsiteUrl, AUTH_OFFSITE_HTML],
  ]);
  const capturedRequests = [];
  const client = new LinkedInClient({
    fetchImpl: createRequestCapturingFetch(responses, capturedRequests),
    config: {
      baseUrl: "https://www.linkedin.com",
      defaultLocation: "United States",
      defaultLimit: 10,
      defaultPostedWithinDays: 30,
      defaultIncludeDetails: true,
      timeoutMs: 1000,
      acceptLanguage: "en-US,en;q=0.9",
      userAgent: "test-agent",
      cookieHeader: "li_at=live-cookie",
      cookieSource: "li_at",
    },
  });

  const result = await client.getJobDetails({
    url: linkedinUrl,
  }, undefined, async () => {});

  assert.equal(result.job.jobId, "4440834442");
  assert.equal(result.job.title, "Senior DevSecOps Engineer");
  assert.equal(result.job.company, "PactFi");
  assert.equal(result.job.location, "New York, NY (Hybrid)");
  assert.match(result.job.description, /Responsibilities include security automation/);
  assert.match(result.job.descriptionExcerpt, /bank-grade private credit infrastructure/);
  assert.equal(result.job.compensation.hasCompensation, true);
  assert.equal(result.job.compensation.ranges[0].min, 190000);
  assert.equal(result.job.compensation.ranges[0].max, 240000);
  assert.equal(capturedRequests.length, 2);
  assert.equal(capturedRequests[0].headers.cookie, "li_at=live-cookie");
  assert.equal(capturedRequests[1].headers.cookie, undefined);
});
