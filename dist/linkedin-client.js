import { select } from "cheerio-select";
import { getAttributeValue, getInnerHTML, getText } from "domutils";
import { parseDocument } from "htmlparser2";
import { ensureConfigTemplate, getEnvPath, loadConfig } from "./config.js";
import { createToolError, emitProgress, throwIfAborted } from "./tool-runtime.js";

const TITLE_PATTERNS = [
  { canonical: "software engineer", patterns: [/\bsoftware engineer\b/i, /\bsoftware developer\b/i, /\bapplication developer\b/i] },
  { canonical: "backend engineer", patterns: [/\bback[- ]?end engineer\b/i, /\bbackend developer\b/i, /\bserver[- ]side engineer\b/i] },
  { canonical: "frontend engineer", patterns: [/\bfront[- ]?end engineer\b/i, /\bfront[- ]?end developer\b/i, /\bui engineer\b/i] },
  { canonical: "full stack engineer", patterns: [/\bfull[- ]?stack engineer\b/i, /\bfull[- ]?stack developer\b/i] },
  { canonical: "data engineer", patterns: [/\bdata engineer\b/i] },
  { canonical: "data scientist", patterns: [/\bdata scientist\b/i] },
  { canonical: "machine learning engineer", patterns: [/\bmachine learning engineer\b/i, /\bml engineer\b/i, /\bai engineer\b/i] },
  { canonical: "devops engineer", patterns: [/\bdevops engineer\b/i, /\bsite reliability engineer\b/i, /\bsre\b/i, /\bplatform engineer\b/i] },
  { canonical: "product manager", patterns: [/\bproduct manager\b/i] },
  { canonical: "project manager", patterns: [/\bproject manager\b/i, /\bprogram manager\b/i] },
  { canonical: "security engineer", patterns: [/\bsecurity engineer\b/i, /\bsecurity analyst\b/i, /\bapplication security\b/i] },
  { canonical: "qa engineer", patterns: [/\bqa engineer\b/i, /\bquality assurance\b/i, /\btest automation\b/i] },
  { canonical: "solutions architect", patterns: [/\bsolutions architect\b/i, /\bsolution architect\b/i, /\bsoftware architect\b/i] },
  { canonical: "designer", patterns: [/\bproduct designer\b/i, /\bux designer\b/i, /\bui designer\b/i] },
  { canonical: "marketing manager", patterns: [/\bmarketing manager\b/i, /\bdigital marketing\b/i, /\bgrowth marketer\b/i] },
  { canonical: "sales engineer", patterns: [/\bsales engineer\b/i, /\bsolutions engineer\b/i] },
  { canonical: "customer success manager", patterns: [/\bcustomer success\b/i] },
];

const SKILL_PATTERNS = [
  { canonical: "javascript", patterns: [/\bjavascript\b/i, /\bjs\b/i] },
  { canonical: "typescript", patterns: [/\btypescript\b/i, /\bts\b/i] },
  { canonical: "node.js", patterns: [/\bnode\.?js\b/i] },
  { canonical: "react", patterns: [/\breact\b/i, /\breactjs\b/i] },
  { canonical: "vue", patterns: [/\bvue\b/i, /\bvue\.js\b/i] },
  { canonical: "angular", patterns: [/\bangular\b/i] },
  { canonical: "python", patterns: [/\bpython\b/i] },
  { canonical: "java", patterns: [/\bjava\b/i] },
  { canonical: "c#", patterns: [/\bc#\b/i, /\bdotnet\b/i, /\b\.net\b/i] },
  { canonical: "go", patterns: [/\bgolang\b/i, /\bgo\b/i] },
  { canonical: "rust", patterns: [/\brust\b/i] },
  { canonical: "php", patterns: [/\bphp\b/i] },
  { canonical: "sql", patterns: [/\bsql\b/i] },
  { canonical: "postgresql", patterns: [/\bpostgresql\b/i, /\bpostgres\b/i] },
  { canonical: "mysql", patterns: [/\bmysql\b/i] },
  { canonical: "mongodb", patterns: [/\bmongodb\b/i, /\bmongo\b/i] },
  { canonical: "redis", patterns: [/\bredis\b/i] },
  { canonical: "docker", patterns: [/\bdocker\b/i] },
  { canonical: "kubernetes", patterns: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { canonical: "aws", patterns: [/\baws\b/i, /\bamazon web services\b/i] },
  { canonical: "azure", patterns: [/\bazure\b/i] },
  { canonical: "gcp", patterns: [/\bgcp\b/i, /\bgoogle cloud\b/i] },
  { canonical: "terraform", patterns: [/\bterraform\b/i] },
  { canonical: "ansible", patterns: [/\bansible\b/i] },
  { canonical: "linux", patterns: [/\blinux\b/i] },
  { canonical: "graphql", patterns: [/\bgraphql\b/i] },
  { canonical: "rest", patterns: [/\brest\b/i, /\brestful\b/i] },
  { canonical: "microservices", patterns: [/\bmicroservices?\b/i] },
  { canonical: "ci/cd", patterns: [/\bci\/cd\b/i, /\bcontinuous integration\b/i] },
  { canonical: "git", patterns: [/\bgit\b/i] },
  { canonical: "playwright", patterns: [/\bplaywright\b/i] },
  { canonical: "cypress", patterns: [/\bcypress\b/i] },
  { canonical: "elasticsearch", patterns: [/\belasticsearch\b/i, /\belastic search\b/i] },
  { canonical: "machine learning", patterns: [/\bmachine learning\b/i, /\bml\b/i] },
  { canonical: "pytorch", patterns: [/\bpytorch\b/i] },
  { canonical: "tensorflow", patterns: [/\btensorflow\b/i] },
  { canonical: "pandas", patterns: [/\bpandas\b/i] },
  { canonical: "numpy", patterns: [/\bnumpy\b/i] },
  { canonical: "spark", patterns: [/\bspark\b/i] },
  { canonical: "tableau", patterns: [/\btableau\b/i] },
  { canonical: "power bi", patterns: [/\bpower bi\b/i] },
];

const STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "into", "is", "of", "on", "or", "that", "the", "to", "with",
]);

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseHtml(html) {
  return parseDocument(String(html ?? ""));
}

function selectNodes(root, selector) {
  return select(selector, root);
}

function selectFirstNode(root, selector) {
  return selectNodes(root, selector)[0] || null;
}

function getNodeAttribute(node, name) {
  return node ? getAttributeValue(node, name) ?? "" : "";
}

function getNodeHtml(node) {
  return node ? getInnerHTML(node) : "";
}

function getNodeText(node) {
  return node ? getText(node) : "";
}

function hasText(value) {
  return normalizeWhitespace(value).length > 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function truncate(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function countMatches(text, patterns) {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function tokenize(text) {
  return unique(
    normalizeWhitespace(text)
      .toLowerCase()
      .replace(/[^a-z0-9+#.\-/\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
  );
}

function extractHeadline(resumeText) {
  const lines = String(resumeText ?? "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return lines.find((line) => line.length <= 90 && /(engineer|developer|manager|scientist|architect|designer|analyst|specialist|consultant|lead)/i.test(line)) || null;
}

export function buildResumeProfile(resumeText, explicitQuery) {
  const source = String(resumeText ?? "");
  const lowered = source.toLowerCase();
  const headline = extractHeadline(source);
  const titles = unique(
    TITLE_PATTERNS
      .filter((entry) => countMatches(lowered, entry.patterns) > 0)
      .map((entry) => entry.canonical),
  );
  const skills = unique(
    SKILL_PATTERNS
      .filter((entry) => countMatches(lowered, entry.patterns) > 0)
      .map((entry) => entry.canonical),
  );

  let suggestedQuery = normalizeWhitespace(explicitQuery);
  if (!suggestedQuery) {
    const parts = [];
    if (titles.length > 0) {
      parts.push(titles.slice(0, 2).join(" "));
    } else if (headline) {
      parts.push(tokenize(headline).slice(0, 6).join(" "));
    }
    if (skills.length > 0) {
      parts.push(skills.slice(0, 3).join(" "));
    }
    suggestedQuery = normalizeWhitespace(parts.join(" "));
  }

  return {
    headline,
    titles,
    skills,
    suggestedQuery,
    queryTokens: tokenize(suggestedQuery),
  };
}

export function normalizeJobUrl(rawUrl, baseUrl = "https://www.linkedin.com") {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl, baseUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function decodeEscapedValue(value) {
  return String(value ?? "")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u0027/gi, "'")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function decodeHtmlEntities(value) {
  if (!value) {
    return "";
  }

  return getNodeText(parseHtml(`<div>${String(value)}</div>`));
}

function extractFirstMatch(text, regex) {
  const match = String(text ?? "").match(regex);
  if (!match?.[1]) {
    return null;
  }

  return normalizeWhitespace(decodeEscapedValue(match[1]));
}

function parseLinkedInDocumentTitle(value) {
  const title = normalizeWhitespace(value);
  const match = title.match(/^(.*?)\s+\|\s+(.*?)\s+\|\s+LinkedIn$/i);
  if (!match) {
    return {
      title: title || "",
      company: "",
    };
  }

  return {
    title: normalizeWhitespace(match[1]),
    company: normalizeWhitespace(match[2]),
  };
}

function parseOffsiteDocumentTitle(value) {
  const title = normalizeWhitespace(value);
  for (const regex of [/^(.*?)\s+@\s+(.*)$/i, /^(.*?)\s+\|\s+(.*)$/i, /^(.*?)\s+-\s+(.*)$/i]) {
    const match = title.match(regex);
    if (match) {
      return {
        title: normalizeWhitespace(match[1]),
        company: normalizeWhitespace(match[2]),
      };
    }
  }

  return {
    title,
    company: "",
  };
}

export function parseJobId(value) {
  const source = String(value ?? "");
  const fromUrn = source.match(/jobPosting:(\d+)/i);
  if (fromUrn) {
    return fromUrn[1];
  }
  const fromPath = source.match(/-(\d+)(?:[/?#]|$)/);
  if (fromPath) {
    return fromPath[1];
  }
  const direct = source.match(/\b(\d{6,})\b/);
  return direct ? direct[1] : null;
}

export function extractSearchCards(html, options = {}) {
  const documentNode = parseHtml(html);
  const cards = [];
  const baseUrl = options.baseUrl || "https://www.linkedin.com";

  for (const [index, card] of selectNodes(documentNode, ".base-search-card").entries()) {
    const url = normalizeJobUrl(getNodeAttribute(selectFirstNode(card, ".base-card__full-link"), "href"), baseUrl);
    const jobId = parseJobId(url || getNodeAttribute(card, "data-entity-urn"));
    const title = normalizeWhitespace(getNodeText(selectFirstNode(card, ".base-search-card__title")));
    const company = normalizeWhitespace(getNodeText(selectFirstNode(card, ".base-search-card__subtitle")));
    const location = normalizeWhitespace(getNodeText(selectFirstNode(card, ".job-search-card__location")));
    const time = selectFirstNode(card, "time");
    const postedText = normalizeWhitespace(getNodeText(time));
    const postedDate = getNodeAttribute(time, "datetime") || null;

    if (!title || !url) {
      continue;
    }

    cards.push({
      rank: index + 1,
      jobId,
      title,
      company,
      location,
      url,
      postedDate,
      postedText,
    });
  }

  return cards;
}

export function extractJobDetails(html, options = {}) {
  const documentNode = parseHtml(html);
  const baseUrl = options.baseUrl || "https://www.linkedin.com";
  const sourceUrl = normalizeJobUrl(options.sourceUrl, baseUrl);
  const criteria = {};

  for (const criteriaItem of selectNodes(documentNode, ".description__job-criteria-item")) {
    const label = normalizeWhitespace(getNodeText(selectFirstNode(criteriaItem, ".description__job-criteria-subheader")));
    const value = normalizeWhitespace(getNodeText(selectFirstNode(criteriaItem, ".description__job-criteria-text")));
    if (label && value) {
      criteria[label] = value;
    }
  }

  const canonicalUrl = normalizeJobUrl(
    getNodeAttribute(selectFirstNode(documentNode, "link[rel='canonical']"), "href")
      || getNodeAttribute(selectFirstNode(documentNode, "meta[property='og:url']"), "content"),
    baseUrl,
  ) || sourceUrl;
  const description = normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".show-more-less-html__markup")));

  return {
    jobId: parseJobId(canonicalUrl || sourceUrl || ""),
    url: canonicalUrl,
    title: normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".topcard__title"))),
    company: normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".topcard__org-name-link"))),
    location: normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".topcard__flavor--bullet"))),
    postedText: normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".posted-time-ago__text"))) || normalizeWhitespace(getNodeText(selectFirstNode(documentNode, "time"))),
    applicantCount: normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".num-applicants__caption"))) || normalizeWhitespace(getNodeText(selectFirstNode(documentNode, ".num-applicants__figure figcaption"))) || null,
    criteria,
    description,
    descriptionExcerpt: truncate(description, 500),
    __offsiteApplyUrl: null,
  };
}

function extractAuthenticatedShellJobDetails(html, options = {}) {
  const documentNode = parseHtml(html);
  const script = getNodeHtml(selectFirstNode(documentNode, "#rehydrate-data"));
  if (!script) {
    return null;
  }
  const readableScript = decodeEscapedValue(script);

  const baseUrl = options.baseUrl || "https://www.linkedin.com";
  const sourceUrl = normalizeJobUrl(options.sourceUrl, baseUrl);
  const parsedTitle = parseLinkedInDocumentTitle(getNodeText(selectFirstNode(documentNode, "title")));
  const jobId = extractFirstMatch(readableScript, /"jobId":"(\d+)"/);
  const company = extractFirstMatch(readableScript, /"companyName":"([^"]+)"/)
    || parsedTitle.company;
  const jobTitle = extractFirstMatch(readableScript, /"jobTitle":"([^"]+)"/)
    || parsedTitle.title;
  const offsiteApplyUrl = extractFirstMatch(readableScript, /"offsiteApplyUrl":"([^"]+)"/);
  const subtitleCandidates = [...readableScript.matchAll(/children":\["([^"]+ • [^"]+)"\]/g)]
    .map((match) => normalizeWhitespace(decodeEscapedValue(match[1])));
  const subtitle = subtitleCandidates.find((value) => company && value.startsWith(`${company} • `)) || "";
  const location = subtitle && company
    ? normalizeWhitespace(subtitle.slice(company.length + 3))
    : "";
  const postedCandidates = [...readableScript.matchAll(/children":\["([^"]*(?:Reposted|ago|applicant|applications?)[^"]*)"\]/gi)]
    .map((match) => normalizeWhitespace(decodeEscapedValue(match[1])));

  if (!hasText(jobTitle) && !hasText(company) && !offsiteApplyUrl) {
    return null;
  }

  return {
    jobId: jobId || parseJobId(sourceUrl || ""),
    url: sourceUrl,
    title: jobTitle,
    company,
    location,
    postedText: postedCandidates.find(Boolean) || "",
    applicantCount: null,
    criteria: {},
    description: "",
    descriptionExcerpt: "",
    __offsiteApplyUrl: offsiteApplyUrl || null,
  };
}

function extractOffsiteJobDetails(html, options = {}) {
  const documentNode = parseHtml(html);
  const sourceUrl = options.sourceUrl || null;
  const titleTag = normalizeWhitespace(getNodeText(selectFirstNode(documentNode, "title")))
    || normalizeWhitespace(getNodeAttribute(selectFirstNode(documentNode, "meta[property='og:title']"), "content"))
    || normalizeWhitespace(getNodeAttribute(selectFirstNode(documentNode, "meta[name='title']"), "content"));
  const parsedTitle = parseOffsiteDocumentTitle(titleTag);
  const metaDescription = normalizeWhitespace(decodeHtmlEntities(
    getNodeAttribute(selectFirstNode(documentNode, "meta[name='description']"), "content")
      || getNodeAttribute(selectFirstNode(documentNode, "meta[property='og:description']"), "content")
      || getNodeAttribute(selectFirstNode(documentNode, "meta[name='twitter:description']"), "content")
      || "",
  ));
  const bodySelectors = [
    "[data-automation-id='jobPostingDescription']",
    "[data-testid='job-description']",
    ".job-description",
    "article",
    "main",
    ".content",
  ];
  let longestBody = "";
  for (const selector of bodySelectors) {
    const text = normalizeWhitespace(getNodeText(selectFirstNode(documentNode, selector)));
    if (text.length > longestBody.length) {
      longestBody = text;
    }
  }

  const description = longestBody.length > Math.max(metaDescription.length + 120, 500)
    ? longestBody
    : (metaDescription || longestBody);

  return {
    jobId: parseJobId(sourceUrl || ""),
    url: null,
    title: parsedTitle.title,
    company: parsedTitle.company,
    location: "",
    postedText: "",
    applicantCount: null,
    criteria: {},
    description,
    descriptionExcerpt: truncate(description, 500),
    __offsiteApplyUrl: sourceUrl,
  };
}

function hasMeaningfulJobDetails(details) {
  return Boolean(details && (
    hasText(details.title)
    || hasText(details.company)
    || hasText(details.location)
    || hasText(details.description)
    || hasText(details.postedText)
    || details.applicantCount
    || Object.keys(details.criteria || {}).length > 0
  ));
}

function mergeJobDetails(primary, fallback) {
  if (!primary) {
    return fallback;
  }
  if (!fallback) {
    return primary;
  }

  const description = hasText(primary.description)
    ? primary.description
    : fallback.description;

  return {
    jobId: primary.jobId || fallback.jobId || null,
    url: primary.url || fallback.url || null,
    title: primary.title || fallback.title || "",
    company: primary.company || fallback.company || "",
    location: primary.location || fallback.location || "",
    postedText: primary.postedText || fallback.postedText || "",
    applicantCount: primary.applicantCount || fallback.applicantCount || null,
    criteria: {
      ...(fallback.criteria || {}),
      ...(primary.criteria || {}),
    },
    description,
    descriptionExcerpt: hasText(description) ? truncate(description, 500) : "",
    compensation: primary.compensation || fallback.compensation || null,
    __offsiteApplyUrl: primary.__offsiteApplyUrl || fallback.__offsiteApplyUrl || null,
  };
}

function sanitizeJobDetails(details) {
  if (!details) {
    return details;
  }

  const { __offsiteApplyUrl, ...publicDetails } = details;
  return publicDetails;
}

function normalizeCurrencyCode(rawCurrency) {
  const value = String(rawCurrency ?? "").toUpperCase();
  if (value === "$" || value === "USD" || value === "US$") return "USD";
  if (value === "CA$" || value === "C$") return "CAD";
  if (value === "A$") return "AUD";
  if (value === "£" || value === "GBP") return "GBP";
  if (value === "€" || value === "EUR") return "EUR";
  return value || null;
}

function parseMoneyAmount(rawValue, fallbackCurrency) {
  const source = normalizeWhitespace(rawValue);
  if (!source) {
    return null;
  }

  const match = source.match(/^(USD|US\$|CA\$|C\$|A\$|GBP|EUR|£|€|\$)?\s?(\d[\d,]*(?:\.\d+)?)\s?([KMBT])?$/i);
  if (!match) {
    return null;
  }

  const [, rawCurrency, rawNumber, rawSuffix] = match;
  const base = Number.parseFloat(rawNumber.replace(/,/g, ""));
  if (!Number.isFinite(base)) {
    return null;
  }

  const suffix = (rawSuffix || "").toUpperCase();
  const multiplier = suffix === "K"
    ? 1_000
    : suffix === "M"
      ? 1_000_000
      : suffix === "B"
        ? 1_000_000_000
        : suffix === "T"
          ? 1_000_000_000_000
          : 1;

  return {
    text: source,
    currency: normalizeCurrencyCode(rawCurrency) || fallbackCurrency || "USD",
    value: base * multiplier,
  };
}

function inferCompensationInterval(context) {
  const text = String(context ?? "").toLowerCase();
  if (/per hour|hourly|\/hr|an hour/.test(text)) return "hour";
  if (/per month|monthly/.test(text)) return "month";
  if (/per week|weekly/.test(text)) return "week";
  if (/annual|annually|per year|yearly|salary|base wage|base salary|base compensation/.test(text)) return "year";
  return null;
}

function inferCompensationType(context) {
  const text = String(context ?? "").toLowerCase();
  if (/ote|on-target/.test(text)) return "ote";
  if (/base wage/.test(text)) return "base_wage";
  if (/base compensation/.test(text)) return "base_compensation";
  if (/base salary|salary range/.test(text)) return "base_salary";
  if (/compensation/.test(text)) return "compensation";
  if (/pay range|pay band/.test(text)) return "pay_range";
  return null;
}

function extractCompensationLabel(beforeText, afterText) {
  const before = normalizeWhitespace(beforeText);
  const after = normalizeWhitespace(afterText);
  const beforeMatch = before.match(/(?:^|[-•])\s*([A-Za-z][A-Za-z/&()\-\s]{2,40}?):\s*$/);
  if (beforeMatch) {
    return normalizeWhitespace(beforeMatch[1]);
  }

  const afterMatch = after.match(/^\s*(?:USD|CAD|AUD|GBP|EUR)?\s*(?:annually|annual|per year|per hour|hourly)?\s*(?:for|if)\s+([A-Za-z][A-Za-z/&()\-\s]{2,40}?)(?:[.,;)]|$)/i);
  if (afterMatch) {
    return normalizeWhitespace(afterMatch[1]);
  }

  return null;
}

function isPlausibleCompensationRange(lowerValue, upperValue) {
  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue)) {
    return false;
  }
  if (lowerValue <= 0 || upperValue <= 0 || upperValue < lowerValue) {
    return false;
  }
  if (upperValue > 5_000_000) {
    return false;
  }
  return true;
}

function formatCompensationRange(range) {
  const label = range.label ? `${range.label}: ` : "";
  const interval = range.interval ? ` ${range.interval}` : "";
  return `${label}${range.text}${interval}`.trim();
}

export function extractCompensationInfo(text) {
  const source = normalizeWhitespace(text);
  if (!source) {
    return {
      hasCompensation: false,
      ranges: [],
      summary: null,
    };
  }

  const compensationContextRegex = /(salary|base salary|base wage|base compensation|compensation|pay range|pay band|hourly|annually|annual|per year|per hour|ote|on-target)/i;
  const rangeRegex = /((?:USD|US\$|CA\$|C\$|A\$|GBP|EUR|£|€|\$)\s?\d[\d,]*(?:\.\d+)?\s?(?:[KMBT])?)\s*(?:-|–|—|to)\s*((?:(?:USD|US\$|CA\$|C\$|A\$|GBP|EUR|£|€|\$)\s?)?\d[\d,]*(?:\.\d+)?\s?(?:[KMBT])?)/gi;
  const ranges = [];
  const seen = new Set();
  let match;

  while ((match = rangeRegex.exec(source))) {
    const lower = parseMoneyAmount(match[1]);
    const upper = parseMoneyAmount(match[2], lower?.currency);
    if (!lower || !upper || !isPlausibleCompensationRange(lower.value, upper.value)) {
      continue;
    }

    const snippetStart = Math.max(0, match.index - 160);
    const snippetEnd = Math.min(source.length, rangeRegex.lastIndex + 160);
    const snippet = source.slice(snippetStart, snippetEnd);
    if (!compensationContextRegex.test(snippet)) {
      continue;
    }

    const localIndex = match.index - snippetStart;
    const before = snippet.slice(0, localIndex);
    const after = snippet.slice(localIndex + match[0].length);
    const interval = inferCompensationInterval(snippet);
    const label = extractCompensationLabel(before, after);
    const type = inferCompensationType(snippet);
    const key = [lower.currency, lower.value, upper.value, interval || "", label || "", type || ""].join(":");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    ranges.push({
      text: normalizeWhitespace(match[0]),
      currency: lower.currency,
      min: lower.value,
      max: upper.value,
      interval,
      type,
      label,
      sourceText: normalizeWhitespace(snippet),
    });
  }

  return {
    hasCompensation: ranges.length > 0,
    ranges,
    summary: ranges.length > 0
      ? ranges.slice(0, 3).map(formatCompensationRange).join("; ")
      : null,
  };
}

export function scoreJobAgainstProfile(job, profile, requestedLocation) {
  const haystack = [
    job.title,
    job.company,
    job.location,
    job.details?.description,
    ...(job.details ? Object.entries(job.details.criteria).flat() : []),
  ].join(" ").toLowerCase();

  const matchedKeywords = new Set();
  let score = 0;

  for (const title of profile.titles) {
    if (haystack.includes(title.toLowerCase())) {
      matchedKeywords.add(title);
      score += 30;
    }
  }

  for (const skill of profile.skills) {
    if (haystack.includes(skill.toLowerCase())) {
      matchedKeywords.add(skill);
      score += 6;
    }
  }

  for (const token of profile.queryTokens) {
    if (haystack.includes(token)) {
      matchedKeywords.add(token);
      score += 2;
    }
  }

  if (requestedLocation && haystack.includes(String(requestedLocation).toLowerCase())) {
    score += 10;
  }

  if (job.postedDate) {
    const ageMs = Date.now() - Date.parse(job.postedDate);
    if (Number.isFinite(ageMs)) {
      const ageDays = ageMs / 86400000;
      if (ageDays <= 7) {
        score += 6;
      } else if (ageDays <= 30) {
        score += 3;
      }
    }
  }

  const matches = [...matchedKeywords];
  return {
    matchScore: score,
    matchedKeywords: matches,
    matchSummary: matches.length > 0
      ? `Matched ${matches.length} resume keywords`
      : "No strong keyword overlap detected",
  };
}

export function buildSearchUrl({ baseUrl, query, location, start = 0, postedWithinDays }) {
  const url = new URL("/jobs-guest/jobs/api/seeMoreJobPostings/search", baseUrl);
  url.searchParams.set("keywords", query);
  if (location) {
    url.searchParams.set("location", location);
  }
  if (start > 0) {
    url.searchParams.set("start", String(start));
  }
  if (postedWithinDays) {
    url.searchParams.set("f_TPR", `r${Math.max(1, postedWithinDays) * 86400}`);
  }
  return url.toString();
}

function categorizeHttpStatus(status) {
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "unknown";
}

function isLinkedInHost(url, baseUrl) {
  try {
    const target = new URL(url, baseUrl);
    const hostname = target.hostname.toLowerCase();
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function buildFetchHeaders(config, url) {
  const headers = {
    "accept-language": config.acceptLanguage,
    "user-agent": config.userAgent,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  if (config.cookieHeader && isLinkedInHost(url, config.baseUrl)) {
    headers.cookie = config.cookieHeader;
  }

  return headers;
}

function hasConfiguredCookie(config) {
  return Boolean(normalizeWhitespace(config.cookieHeader || ""));
}

function buildAccessContext(config) {
  const authenticated = hasConfiguredCookie(config);
  const cookieSource = config.cookieSource || "none";

  return {
    authenticated,
    mode: authenticated ? "authenticated" : "guest",
    cookieConfigured: authenticated,
    cookieSource,
    visibilityNotice: authenticated
      ? "Authenticated LinkedIn session is configured. Results may include detail pages that are less available to guest access."
      : "Guest LinkedIn access is in use. Results may be incomplete, auth-walled, rate-limited, or less detailed than a logged-in session with LINKEDIN_LI_AT or LINKEDIN_COOKIE.",
  };
}

function buildAuthenticationGuidance(config) {
  return hasConfiguredCookie(config)
    ? "LinkedIn rejected the configured session cookie. Refresh LINKEDIN_LI_AT or LINKEDIN_COOKIE in ~/.config/pi-linkedin/.env from a current logged-in browser session and retry."
    : "LinkedIn blocked this request as a guest session. Add LINKEDIN_LI_AT or LINKEDIN_COOKIE to ~/.config/pi-linkedin/.env from a current logged-in browser session and retry.";
}

function isAuthWallUrl(value) {
  const url = String(value ?? "");
  return /linkedin\.com\/.*(?:authwall|checkpoint|login|uas\/login)/i.test(url);
}

function isAuthWallHtml(value) {
  const html = String(value ?? "");
  return /authwall/i.test(html)
    || /checkpoint\/lg\/login-submit/i.test(html)
    || /guest_homepage-basic_sign-in/i.test(html);
}

function createAuthenticationError(config, status = 403) {
  return createToolError(
    hasConfiguredCookie(config)
      ? `LinkedIn rejected the configured session cookie (status ${status})`
      : `LinkedIn requires an authenticated LinkedIn session for this request (status ${status})`,
    {
      status,
      category: status === 401 ? "authentication" : "authorization",
      guidance: buildAuthenticationGuidance(config),
      retryable: true,
    },
  );
}

function summarizeAuthProbe(config, error) {
  const envPath = getEnvPath();
  const cookieConfigured = hasConfiguredCookie(config);
  const cookieSource = config.cookieSource || "none";
  const sourceLabel = cookieSource === "cookie_header"
    ? "COOKIE header"
    : cookieSource === "li_at"
      ? "LI_AT cookie"
      : "guest session";

  if (!error) {
    return {
      ok: true,
      authenticated: true,
      status: 200,
      category: "ok",
      envPath,
      cookieConfigured,
      cookieSource,
      guidance: cookieConfigured
        ? "Authenticated LinkedIn requests are working with the current cookie configuration."
        : "LinkedIn feed access succeeded without an explicit cookie configuration.",
      summary: cookieConfigured
        ? `LINKEDIN AUTH OK: Reloaded ~/.config/pi-linkedin/.env and the configured ${sourceLabel} was accepted by LinkedIn.`
        : "LINKEDIN AUTH OK: Reloaded ~/.config/pi-linkedin/.env and LinkedIn feed access succeeded.",
    };
  }

  const category = error.category || "unknown";
  const status = error.status || 500;
  let summary = error.message || "LinkedIn auth probe failed.";

  if (category === "authentication" || category === "authorization") {
    summary = cookieConfigured
      ? "LinkedIn auth failed after reload. Refresh LINKEDIN_LI_AT or LINKEDIN_COOKIE in ~/.config/pi-linkedin/.env and rerun /linkedin_auth."
      : "LinkedIn auth is not configured. Add LINKEDIN_LI_AT or LINKEDIN_COOKIE to ~/.config/pi-linkedin/.env and rerun /linkedin_auth.";
  } else if (category === "network" || category === "timeout") {
    summary = "LinkedIn auth test could not reach linkedin.com. Check network access or timeout settings and rerun /linkedin_auth.";
  }

  return {
    ok: false,
    authenticated: false,
    status,
    category,
    envPath,
    cookieConfigured,
    cookieSource,
    guidance: error.guidance || null,
    summary,
  };
}

function mergeSignals(signals) {
  const active = signals.filter(Boolean);
  if (active.length === 0) {
    return undefined;
  }
  if (active.length === 1) {
    return active[0];
  }
  return AbortSignal.any(active);
}

export class LinkedInClient {
  constructor(options = {}) {
    ensureConfigTemplate();
    this.fetchImpl = options.fetchImpl || fetch;
    this.config = options.config || loadConfig();
  }

  reloadConfig() {
    this.config = loadConfig();
    const access = buildAccessContext(this.config);
    return {
      envPath: getEnvPath(),
      cookieConfigured: access.cookieConfigured,
      cookieSource: access.cookieSource,
      accessMode: access.mode,
      defaultLocation: this.config.defaultLocation || null,
      defaultLimit: this.config.defaultLimit,
      defaultPostedWithinDays: this.config.defaultPostedWithinDays,
      defaultIncludeDetails: this.config.defaultIncludeDetails,
    };
  }

  async reloadAndTestAuth(signal) {
    const reload = this.reloadConfig();
    const probeUrl = new URL("/feed/", this.config.baseUrl).toString();

    try {
      await this.fetchText(probeUrl, signal);
      return {
        ...summarizeAuthProbe(this.config),
        ...reload,
        probeUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          ...summarizeAuthProbe(this.config, error),
          ...reload,
          probeUrl,
        };
      }

      return {
        ...summarizeAuthProbe(this.config, createToolError("LinkedIn auth probe failed", {
          status: 500,
          category: "unknown",
          retryable: false,
        })),
        ...reload,
        probeUrl,
      };
    }
  }

  async resolveJobDetailsFromPage(url, html, signal) {
    let details = extractJobDetails(html, {
      baseUrl: this.config.baseUrl,
      sourceUrl: url,
    });
    const authenticatedFallback = extractAuthenticatedShellJobDetails(html, {
      baseUrl: this.config.baseUrl,
      sourceUrl: url,
    });

    if (authenticatedFallback) {
      details = mergeJobDetails(details, authenticatedFallback);
    }

    if (details?.__offsiteApplyUrl && !hasText(details.description)) {
      try {
        const offsiteHtml = await this.fetchText(details.__offsiteApplyUrl, signal, {
          requestKind: "offsite",
        });
        const offsiteDetails = extractOffsiteJobDetails(offsiteHtml, {
          sourceUrl: details.__offsiteApplyUrl,
        });
        if (hasMeaningfulJobDetails(offsiteDetails)) {
          details = mergeJobDetails(details, offsiteDetails);
        }
      } catch {
        // Keep the LinkedIn shell details if the offsite page is unavailable.
      }
    }

    if (!hasMeaningfulJobDetails(details)) {
      return sanitizeJobDetails(details);
    }

    if (details) {
      details.compensation = extractCompensationInfo(details.description);
    }

    return sanitizeJobDetails(details);
  }

  async fetchText(url, signal, options = {}) {
    throwIfAborted(signal);
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), this.config.timeoutMs);
    const combinedSignal = mergeSignals([signal, timeoutController.signal]);
    const requestKind = options.requestKind || "linkedin";

    try {
      const response = await this.fetchImpl(url, {
        headers: buildFetchHeaders(this.config, url),
        redirect: "follow",
        signal: combinedSignal,
      });

      if (!response.ok) {
        if (requestKind === "linkedin" && (response.status === 401 || response.status === 403)) {
          throw createAuthenticationError(this.config, response.status);
        }

        throw createToolError(`LinkedIn request failed with status ${response.status}`, {
          status: response.status,
          category: categorizeHttpStatus(response.status),
          guidance: response.status === 429
            ? "Reduce the request rate or try again later."
            : "Verify the job or search URL and retry.",
          retryable: response.status >= 500 || response.status === 429,
        });
      }

      const text = await response.text();
      if (requestKind === "linkedin" && (isAuthWallUrl(response.url) || isAuthWallHtml(text))) {
        throw createAuthenticationError(this.config, hasConfiguredCookie(this.config) ? 401 : 403);
      }

      return text;
    } catch (error) {
      if (timeoutController.signal.aborted && !signal?.aborted) {
        throw createToolError(`LinkedIn request timed out after ${this.config.timeoutMs}ms`, {
          status: 504,
          category: "timeout",
          guidance: "Retry with a smaller result set or a longer timeout.",
          retryable: true,
        });
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw createToolError("LinkedIn request aborted", {
            status: 499,
            category: "canceled",
            retryable: false,
          });
        }
        if (error.status) {
          throw error;
        }
        throw createToolError(`LinkedIn request failed: ${error.message}`, {
          status: 503,
          category: "network",
          guidance: "Check network access to linkedin.com and retry.",
          retryable: true,
        });
      }

      throw createToolError("LinkedIn request failed", {
        status: 503,
        category: "network",
        guidance: "Check network access to linkedin.com and retry.",
        retryable: true,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async searchJobs(options, signal, onUpdate) {
    const requestedLimit = Number.isFinite(options.limit) ? options.limit : this.config.defaultLimit;
    const limit = Math.max(1, Math.min(requestedLimit, 25));
    const start = Math.max(0, Number.isFinite(options.start) ? options.start : 0);
    const location = normalizeWhitespace(options.location) || this.config.defaultLocation;
    const profile = buildResumeProfile(options.resumeText, options.query);
    const query = normalizeWhitespace(options.query) || profile.suggestedQuery;
    const postedWithinDays = Number.isFinite(options.postedWithinDays)
      ? options.postedWithinDays
      : this.config.defaultPostedWithinDays;
    const includeDetails = typeof options.includeDetails === "boolean"
      ? options.includeDetails
      : this.config.defaultIncludeDetails;
    const access = buildAccessContext(this.config);

    if (!query) {
      throw createToolError("Unable to derive LinkedIn search keywords from the supplied resume.", {
        status: 400,
        category: "validation",
        guidance: "Provide resume_text with at least one recognizable role or pass query explicitly.",
        retryable: false,
      });
    }

    const seen = new Set();
    const jobs = [];
    let offset = start;

    while (jobs.length < limit) {
      throwIfAborted(signal);
      const searchUrl = buildSearchUrl({
        baseUrl: this.config.baseUrl,
        query,
        location,
        start: offset,
        postedWithinDays,
      });
      await emitProgress(onUpdate, `Fetching LinkedIn search results at offset ${offset}`);
      const html = await this.fetchText(searchUrl, signal);
      const cards = extractSearchCards(html, { baseUrl: this.config.baseUrl });

      if (cards.length === 0) {
        break;
      }

      for (const card of cards) {
        const key = card.jobId || card.url;
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        jobs.push(card);
        if (jobs.length >= limit) {
          break;
        }
      }

      if (cards.length < 10) {
        break;
      }

      offset += cards.length;
    }

    let ranked = jobs
      .map((job) => ({
        ...job,
        ...scoreJobAgainstProfile(job, profile, location),
      }))
      .sort((left, right) => right.matchScore - left.matchScore || left.rank - right.rank);

    const enrichCount = includeDetails ? Math.min(ranked.length, Math.min(limit, 6)) : 0;
    for (let index = 0; index < enrichCount; index += 1) {
      throwIfAborted(signal);
      const job = ranked[index];
      await emitProgress(onUpdate, `Fetching LinkedIn job details ${index + 1}/${enrichCount}`);
      try {
        const detailHtml = await this.fetchText(job.url, signal);
        const details = await this.resolveJobDetailsFromPage(job.url, detailHtml, signal);
        ranked[index] = {
          ...job,
          details,
          ...scoreJobAgainstProfile({ ...job, details }, profile, location),
        };
      } catch (error) {
        ranked[index] = {
          ...job,
          detailError: error instanceof Error ? error.message : String(error),
        };
      }
    }

    ranked = ranked
      .sort((left, right) => right.matchScore - left.matchScore || left.rank - right.rank)
      .slice(0, limit)
      .map((job, index) => ({
        rank: index + 1,
        jobId: job.jobId,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        postedDate: job.postedDate,
        postedText: job.postedText,
        matchScore: job.matchScore,
        matchedKeywords: job.matchedKeywords,
        matchSummary: job.matchSummary,
        details: job.details ? {
          applicantCount: job.details.applicantCount,
          criteria: job.details.criteria,
          descriptionExcerpt: job.details.descriptionExcerpt,
          compensation: job.details.compensation || null,
          compensationSummary: job.details.compensation?.summary || null,
        } : null,
        detailError: job.detailError || null,
      }));

    return {
      query,
      location: location || null,
      start,
      limit,
      postedWithinDays: postedWithinDays || null,
      includeDetails,
      access,
      derivedProfile: profile,
      resultCount: ranked.length,
      summary: ranked.length > 0
        ? `Found ${ranked.length} LinkedIn job match(es) for \"${query}\". ${access.mode === "guest" ? "Guest access is active, so LinkedIn may be hiding some results or details." : "Authenticated LinkedIn access is active."}`
        : `No LinkedIn jobs found for \"${query}\". ${access.mode === "guest" ? "Guest access is active, so LinkedIn may be hiding some results or details." : "Authenticated LinkedIn access is active."}`,
      results: ranked,
    };
  }

  async getJobDetails(options, signal, onUpdate) {
    const jobId = normalizeWhitespace(options.jobId);
    const url = normalizeJobUrl(options.url, this.config.baseUrl)
      || (jobId ? `${this.config.baseUrl}/jobs/view/${jobId}` : null);
    const access = buildAccessContext(this.config);

    if (!url) {
      throw createToolError("Provide either url or job_id.", {
        status: 400,
        category: "validation",
        guidance: "Pass the public LinkedIn job URL or a numeric LinkedIn job_id.",
        retryable: false,
      });
    }

    await emitProgress(onUpdate, `Fetching LinkedIn job details for ${url}`);
    const html = await this.fetchText(url, signal);
    const job = await this.resolveJobDetailsFromPage(url, html, signal);
    const resumeText = normalizeWhitespace(options.resumeText);

    if (!resumeText) {
      return {
        summary: `Fetched LinkedIn job details for ${job.title || url}. ${access.mode === "guest" ? "Guest access is active, so LinkedIn may be hiding some fields or related metadata." : "Authenticated LinkedIn access is active."}`,
        access,
        job,
      };
    }

    const profile = buildResumeProfile(resumeText, "");
    const scored = scoreJobAgainstProfile({
      title: job.title,
      company: job.company,
      location: job.location,
      details: job,
    }, profile, job.location);

    return {
      summary: `Fetched and scored LinkedIn job details for ${job.title || url}. ${access.mode === "guest" ? "Guest access is active, so LinkedIn may be hiding some fields or related metadata." : "Authenticated LinkedIn access is active."}`,
      access,
      derivedProfile: profile,
      job,
      ...scored,
    };
  }
}

export function getLinkedInAuthCommand(client) {
  return {
    name: "linkedin_auth",
    description: "Reload ~/.config/pi-linkedin/.env and test whether the current LinkedIn cookie/session is working.",
    handler: async (_args, ctx) => {
      const result = await client.reloadAndTestAuth();
      const level = result.ok ? "success" : (result.category === "network" || result.category === "timeout" ? "error" : "warning");
      ctx?.ui?.notify?.(result.summary, level);
      return result;
    },
  };
}
