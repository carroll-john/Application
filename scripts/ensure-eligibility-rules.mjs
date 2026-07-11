import { execSync } from "node:child_process";
import { existsSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = join(
  root,
  "eligibility-service",
  "packages",
  "eligibility-rules",
  "package.json",
);
const siblingPackageJson = join(
  root,
  "..",
  "eligibility-service",
  "packages",
  "eligibility-rules",
  "package.json",
);
const linkPath = join(root, "eligibility-service");
const ref = process.env.ELIGIBILITY_SERVICE_REF ?? "main";
const repoUrl = "https://github.com/carroll-john/eligibility-service.git";

if (existsSync(packageJson)) {
  process.exit(0);
}

if (existsSync(siblingPackageJson)) {
  if (!existsSync(linkPath)) {
    symlinkSync(join(root, "..", "eligibility-service"), linkPath, "dir");
  }
  process.exit(0);
}

execSync(`git clone --depth 1 --branch ${ref} ${repoUrl} ${linkPath}`, {
  cwd: root,
  stdio: "inherit",
});
