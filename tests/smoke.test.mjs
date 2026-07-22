import test from "node:test";
import assert from "node:assert/strict";
import { createFakePi, readFileOrEmpty, withTempLinkedInConfig } from "./helpers.mjs";

const { default: linkedInExtension } = await import("../dist/index.js");

test("extension loads without credentials and registers the expected tool surface", async () => {
  await withTempLinkedInConfig(async ({ envPath }) => {
    const pi = createFakePi();

    assert.doesNotThrow(() => linkedInExtension(pi));
    assert.equal(pi.tools.length, 2);
    assert.equal(pi.commands.length, 1);
    assert.ok(pi.tools.some((tool) => tool.name === "linkedin_search_jobs"));
    assert.ok(pi.tools.some((tool) => tool.name === "linkedin_get_job_details"));
    assert.ok(pi.commands.some((command) => command.name === "linkedin_auth"));

    const envContents = await readFileOrEmpty(envPath);
    assert.match(envContents, /LINKEDIN_DEFAULT_LOCATION=United States/);
    assert.match(envContents, /LINKEDIN_DEFAULT_LIMIT=10/);
    assert.match(envContents, /LINKEDIN_DEFAULT_POSTED_WITHIN_DAYS=30/);
    assert.match(envContents, /LINKEDIN_DEFAULT_INCLUDE_DETAILS=true/);
    assert.match(envContents, /LINKEDIN_TIMEOUT_MS=45000/);
    assert.match(envContents, /LINKEDIN_LI_AT=/);
    assert.match(envContents, /Chrome or Edge:/);
    assert.match(envContents, /Firefox:/);
    assert.match(envContents, /copy the Cookie request header value/i);
  });
});

test("all tools use the linkedin_ prefix", async () => {
  await withTempLinkedInConfig(async () => {
    const pi = createFakePi();
    linkedInExtension(pi);
    const unexpected = pi.tools.map((tool) => tool.name).filter((name) => !name.startsWith("linkedin_"));
    assert.deepEqual(unexpected, []);
  });
});

test("all commands use the linkedin_ prefix", async () => {
  await withTempLinkedInConfig(async () => {
    const pi = createFakePi();
    linkedInExtension(pi);
    const unexpected = pi.commands.map((command) => command.name).filter((name) => !name.startsWith("linkedin_"));
    assert.deepEqual(unexpected, []);
  });
});
