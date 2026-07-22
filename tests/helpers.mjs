import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function createFakePi() {
  const tools = [];
  const commands = [];
  const notifications = [];

  return {
    tools,
    commands,
    notifications,
    registerTool(tool) {
      tools.push(tool);
    },
    registerCommand(name, options) {
      commands.push({ name, ...options });
    },
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
    },
  };
}

const LINKEDIN_ENV_KEYS = [
  "LINKEDIN_CONFIG_DIR",
  "LINKEDIN_BASE_URL",
  "LINKEDIN_DEFAULT_LOCATION",
  "LINKEDIN_DEFAULT_LIMIT",
  "LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS",
  "LINKEDIN_DEFAULT_INCLUDE_DETAILS",
  "LINKEDIN_TIMEOUT_MS",
  "LINKEDIN_ACCEPT_LANGUAGE",
  "LINKEDIN_USER_AGENT",
  "LINKEDIN_LI_AT",
  "LINKEDIN_COOKIE",
];

export async function withTempLinkedInConfig(run) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-linkedin-test-"));
  const previous = new Map(LINKEDIN_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of LINKEDIN_ENV_KEYS) {
    delete process.env[key];
  }

  process.env.LINKEDIN_CONFIG_DIR = tempDir;

  try {
    return await run({
      tempDir,
      envPath: path.join(tempDir, ".env"),
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export async function readFileOrEmpty(filePath) {
  return await fs.readFile(filePath, "utf8");
}
