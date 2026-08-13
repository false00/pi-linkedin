import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package metadata exposes the Pi extension contract", () => {
  assert.equal(pkg.name, "@false00/pi-linkedin");
  assert.equal(pkg.main, "dist/index.js");
  assert.equal(pkg.types, "dist/index.d.ts");
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.ok(pkg.pi?.extensions?.includes("./dist/index.js"));
  assert.equal(pkg.publishConfig?.access, "public");
  assert.equal(pkg.homepage, "https://github.com/false00/pi-linkedin#readme");
  assert.equal(pkg.bugs?.url, "https://github.com/false00/pi-linkedin/issues");
  assert.equal(pkg.directories?.doc, "docs");
  assert.equal(pkg.directories?.test, "tests");
  assert.equal(pkg.engines?.node, ">=22.19.0");
  assert.equal(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"], "*");
  assert.equal(pkg.dependencies?.["@earendil-works/pi-coding-agent"], "^0.84.1");
  assert.equal(pkg.dependencies?.cheerio, undefined);
  assert.equal(pkg.dependencies?.["cheerio-select"], "^2.1.0");
  assert.equal(pkg.dependencies?.domutils, "^3.2.2");
  assert.equal(pkg.dependencies?.htmlparser2, "^10.1.0");
});

test("package lockfile matches published dependency metadata", () => {
  const lockfile = JSON.parse(fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const rootPackage = lockfile.packages?.[""];

  assert.equal(rootPackage?.version, pkg.version);
  assert.equal(rootPackage?.engines?.node, pkg.engines?.node);
  assert.deepEqual(rootPackage?.dependencies, pkg.dependencies);
  assert.equal(lockfile.packages?.["node_modules/cheerio"], undefined);
  assert.equal(
    rootPackage?.peerDependencies?.["@earendil-works/pi-coding-agent"],
    pkg.peerDependencies?.["@earendil-works/pi-coding-agent"],
  );
});

test("published files include docs and policy files", () => {
  const published = new Set(pkg.files ?? []);
  for (const required of [
    "dist",
    "AGENTS.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "README.md",
    "SECURITY.md",
    "docs/COMPATIBILITY.md",
    "docs/EXAMPLES.md",
    "docs/TROUBLESHOOTING.md",
    "LICENSE",
  ]) {
    assert.ok(published.has(required), `missing published file entry: ${required}`);
  }
});

test("top-level trust docs and repository automation exist", () => {
  for (const relativePath of [
    "README.md",
    "AGENTS.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "LICENSE",
    "docs/COMPATIBILITY.md",
    "docs/EXAMPLES.md",
    "docs/TROUBLESHOOTING.md",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
    ".github/workflows/dependency-review.yml",
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.md",
    ".github/ISSUE_TEMPLATE/feature_request.md",
    ".github/ISSUE_TEMPLATE/config.yml",
  ]) {
    assert.ok(fs.existsSync(new URL(`../${relativePath}`, import.meta.url)), `missing ${relativePath}`);
  }
});

test("README and AGENTS document the runtime model and release discipline", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const agents = fs.readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

  for (const section of [
    "## Why this package",
    "## Tool coverage",
    "## Search model",
    "## Trust, safety, and operating model",
    "## Configuration",
    "## Compatibility",
    "## Repository layout",
    "## Development",
  ]) {
    assert.ok(readme.includes(section), `missing README section: ${section}`);
  }

  for (const section of [
    "## Mission",
    "## Pi package conventions",
    "## Testing policy",
    "## Release discipline",
    "## Release checklist",
  ]) {
    assert.ok(agents.includes(section), `missing AGENTS section: ${section}`);
  }
});
