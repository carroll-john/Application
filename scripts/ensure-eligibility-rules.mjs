import { existsSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendoredPackageJson = join(root, "vendor", "eligibility-rules", "package.json");
const siblingPackageJson = join(
  root,
  "..",
  "eligibility-service",
  "packages",
  "eligibility-rules",
  "package.json",
);
const devLinkPath = join(root, "vendor", "eligibility-rules");

if (existsSync(vendoredPackageJson)) {
  process.exit(0);
}

if (existsSync(siblingPackageJson)) {
  symlinkSync(
    join(root, "..", "eligibility-service", "packages", "eligibility-rules"),
    devLinkPath,
    "dir",
  );
}
