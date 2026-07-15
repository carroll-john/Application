import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const coreFiles = [
  "AGENTS.md",
  "README.md",
  "docs/README.md",
  "docs/system-context.md",
  "docs/domains/auth.md",
  "docs/domains/applications.md",
  "docs/domains/documents.md",
  "docs/domains/document-parsing.md",
  "docs/domains/ui.md",
  "docs/decisions/README.md",
  "docs/workflows/agent.md",
  "docs/workflows/ci.md",
  "docs/runbooks/backend.md",
  "docs/runbooks/auth-password.md",
];

const domainFiles = coreFiles.filter((file) => file.startsWith("docs/domains/"));
const decisionFiles = [
  "docs/decisions/0001-authenticated-applicant-data.md",
  "docs/decisions/0002-server-authoritative-submission.md",
  "docs/decisions/0003-eligibility-ownership.md",
  "docs/decisions/0004-service-contract-ownership.md",
  "docs/decisions/0005-code-based-design-system.md",
  "docs/decisions/0006-context-control-plane.md",
  "docs/decisions/0007-integration-platform-boundary.md",
];

const retiredCurrentPaths = [
  "docs/project-memory.md",
  "docs/current-phase.md",
  "docs/decisions.md",
  "docs/memory-auth.md",
  "docs/memory-applications.md",
  "docs/memory-documents.md",
  "docs/memory-document-parsing.md",
  "docs/memory-ui.md",
  "docs/memory-agent-workflow.md",
  "docs/systems-architecture-review.md",
];

const requiredDomainSections = [
  "## Owner",
  "## Current contract",
  "## Approved entry points",
  "## Forbidden shortcuts",
  "## Intentional mirrors",
  "## Required checks",
  "## Related decisions",
];

const errors = [];

function listActiveMarkdown(relativeDirectory) {
  const files = [];
  for (const entry of readdirSync(absolute(relativeDirectory), { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (relativePath === "docs/archive" || relativePath === "docs/reviews") {
        continue;
      }
      files.push(...listActiveMarkdown(relativePath));
    } else if (entry.name.endsWith(".md")) {
      files.push(relativePath);
    }
  }
  return files;
}

function absolute(relativePath) {
  return resolve(root, relativePath);
}

function read(relativePath) {
  return readFileSync(absolute(relativePath), "utf8");
}

function parseFrontmatter(relativePath, content) {
  if (!content.startsWith("---\n")) {
    errors.push(`${relativePath}: missing structured frontmatter`);
    return new Map();
  }

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    errors.push(`${relativePath}: unterminated structured frontmatter`);
    return new Map();
  }

  const values = new Map();
  for (const line of content.slice(4, end).split("\n")) {
    const match = /^([a-z_]+):\s*(.+)$/.exec(line);
    if (match) {
      values.set(match[1], match[2].trim());
    }
  }
  return values;
}

function checkLinks(relativePath, content) {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("#")
    ) {
      continue;
    }

    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = decodeURIComponent(target.split("#")[0]);
    if (!target) {
      continue;
    }

    const targetPath = resolve(dirname(absolute(relativePath)), target);
    if (!existsSync(targetPath)) {
      errors.push(`${relativePath}: broken link target ${match[1]}`);
    }
  }
}

for (const file of [...coreFiles, ...decisionFiles]) {
  if (!existsSync(absolute(file))) {
    errors.push(`${file}: required context file is missing`);
  }
}

for (const retiredPath of retiredCurrentPaths) {
  if (existsSync(absolute(retiredPath))) {
    errors.push(`${retiredPath}: retired current-context path still exists`);
  }
}

if (!read(".gitignore").split(/\r?\n/).includes("TASK.md")) {
  errors.push(".gitignore: TASK.md must remain worktree-local and ignored");
}

if (existsSync(absolute("docs/system-context.md"))) {
  const content = read("docs/system-context.md");
  const meta = parseFrontmatter("docs/system-context.md", content);
  for (const [key, expected] of [
    ["schema_version", "1"],
    ["document_type", "system_context"],
    ["status", "active"],
  ]) {
    if (meta.get(key) !== expected) {
      errors.push(`docs/system-context.md: ${key} must be ${expected}`);
    }
  }
}

const owners = new Set();
for (const file of domainFiles) {
  if (!existsSync(absolute(file))) {
    continue;
  }
  const content = read(file);
  const meta = parseFrontmatter(file, content);
  if (meta.get("document_type") !== "domain_contract") {
    errors.push(`${file}: document_type must be domain_contract`);
  }
  if (meta.get("status") !== "active") {
    errors.push(`${file}: status must be active`);
  }
  const owner = meta.get("owner");
  if (!owner) {
    errors.push(`${file}: owner is required`);
  } else if (owners.has(owner)) {
    errors.push(`${file}: owner ${owner} is already authoritative for another domain`);
  } else {
    owners.add(owner);
  }
  for (const section of requiredDomainSections) {
    if (!content.includes(`${section}\n`)) {
      errors.push(`${file}: missing required section ${section}`);
    }
  }
}

for (const file of decisionFiles) {
  if (!existsSync(absolute(file))) {
    continue;
  }
  const meta = parseFrontmatter(file, read(file));
  for (const key of ["id", "date"]) {
    if (!meta.get(key)) {
      errors.push(`${file}: ${key} is required`);
    }
  }
  if (meta.get("status") !== "active") {
    errors.push(`${file}: status must be active or the decision must leave the active index`);
  }
}

const forbiddenReferences = [
  /docs\/project-memory\.md/g,
  /docs\/current-phase\.md/g,
  /docs\/decisions\.md/g,
  /docs\/memory-[a-z-]+\.md/g,
  /docs\/systems-architecture-review\.md/g,
];

const activeMarkdownFiles = ["AGENTS.md", "README.md", ...listActiveMarkdown("docs")];

for (const file of activeMarkdownFiles) {
  if (!existsSync(absolute(file)) || statSync(absolute(file)).isDirectory()) {
    continue;
  }
  const content = read(file);
  checkLinks(file, content);
  if (/\bfigma\b/i.test(content)) {
    errors.push(`${file}: active context must use the code-based design system, not Figma`);
  }
  for (const pattern of forbiddenReferences) {
    if (pattern.test(content)) {
      errors.push(`${file}: references a retired current-context path (${pattern.source})`);
    }
    pattern.lastIndex = 0;
  }
}

if (errors.length > 0) {
  console.error("Context validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Context structure OK (${coreFiles.length + decisionFiles.length} required context files, ${activeMarkdownFiles.length} active Markdown files checked).`,
);
