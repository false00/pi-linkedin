import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ENV_TEMPLATE = `# LinkedIn public-search defaults for @false00/pi-linkedin
# This package uses LinkedIn's public job pages by default and can optionally
# reuse your own LinkedIn session cookie for authenticated requests.

LINKEDIN_BASE_URL=https://www.linkedin.com
LINKEDIN_DEFAULT_LOCATION=United States
LINKEDIN_DEFAULT_LIMIT=10
LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30
LINKEDIN_DEFAULT_INCLUDE_DETAILS=true
LINKEDIN_TIMEOUT_MS=45000
LINKEDIN_ACCEPT_LANGUAGE=en-US,en;q=0.9
LINKEDIN_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36

# Optional authenticated session support.
# Preferred: copy the raw li_at cookie value into LINKEDIN_LI_AT.
# Chrome or Edge:
#   1. Open https://www.linkedin.com while logged in.
#   2. Press F12 -> Application -> Storage -> Cookies -> https://www.linkedin.com
#   3. Copy the li_at cookie value into LINKEDIN_LI_AT below.
# Firefox:
#   1. Open https://www.linkedin.com while logged in.
#   2. Press F12 -> Storage -> Cookies -> https://www.linkedin.com
#   3. Copy the li_at cookie value into LINKEDIN_LI_AT below.
# If li_at alone is not enough, set LINKEDIN_COOKIE to the full Cookie header.
# Easiest fallback in Chrome/Firefox: Network tab -> open a LinkedIn request ->
# copy the Cookie request header value and paste it into LINKEDIN_COOKIE.
# Example full Cookie header: li_at=...; JSESSIONID="ajax:..."; lang=v=2&lang=en-us
LINKEDIN_LI_AT=
LINKEDIN_COOKIE=
`;

function parseDotEnv(text) {
  const entries = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }

  return entries;
}

function toInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeOptional(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : undefined;
}

function buildCookieHeader(config) {
  const explicitCookie = normalizeOptional(config.LINKEDIN_COOKIE);
  if (explicitCookie) {
    return explicitCookie;
  }

  const liAt = normalizeOptional(config.LINKEDIN_LI_AT);
  if (!liAt) {
    return undefined;
  }

  return `li_at=${liAt}`;
}

function resolveCookieSource(config) {
  if (normalizeOptional(config.LINKEDIN_COOKIE)) {
    return "cookie_header";
  }
  if (normalizeOptional(config.LINKEDIN_LI_AT)) {
    return "li_at";
  }
  return "none";
}

export function getConfigDir() {
  return process.env.LINKEDIN_CONFIG_DIR || path.join(os.homedir(), ".config", "pi-linkedin");
}

export function getEnvPath(configDir = getConfigDir()) {
  return path.join(configDir, ".env");
}

export function ensureConfigTemplate() {
  const configDir = getConfigDir();
  const envPath = getEnvPath(configDir);

  try {
    mkdirSync(configDir, { recursive: true });
    if (!existsSync(envPath)) {
      writeFileSync(envPath, ENV_TEMPLATE, "utf8");
    }
  } catch (error) {
    console.warn("[pi-linkedin] failed to initialize config template", error);
  }

  return envPath;
}

export function loadConfig() {
  const envPath = ensureConfigTemplate();
  let fileConfig = {};

  if (existsSync(envPath)) {
    fileConfig = parseDotEnv(readFileSync(envPath, "utf8"));
  }

  const config = {
    LINKEDIN_BASE_URL: "https://www.linkedin.com",
    LINKEDIN_DEFAULT_LOCATION: "United States",
    LINKEDIN_DEFAULT_LIMIT: "10",
    LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS: "30",
    LINKEDIN_DEFAULT_INCLUDE_DETAILS: "true",
    LINKEDIN_TIMEOUT_MS: "45000",
    LINKEDIN_ACCEPT_LANGUAGE: "en-US,en;q=0.9",
    LINKEDIN_USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    LINKEDIN_LI_AT: "",
    LINKEDIN_COOKIE: "",
    ...process.env,
    ...fileConfig,
  };

  return {
    baseUrl: config.LINKEDIN_BASE_URL,
    defaultLocation: config.LINKEDIN_DEFAULT_LOCATION || undefined,
    defaultLimit: Math.max(1, Math.min(toInteger(config.LINKEDIN_DEFAULT_LIMIT, 10), 25)),
    defaultPostedWithinDays: Math.max(1, Math.min(toInteger(config.LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS, 30), 365)),
    defaultIncludeDetails: toBoolean(config.LINKEDIN_DEFAULT_INCLUDE_DETAILS, true),
    timeoutMs: Math.max(1000, toInteger(config.LINKEDIN_TIMEOUT_MS, 30000)),
    acceptLanguage: config.LINKEDIN_ACCEPT_LANGUAGE,
    userAgent: config.LINKEDIN_USER_AGENT,
    cookieHeader: buildCookieHeader(config),
    cookieSource: resolveCookieSource(config),
  };
}
