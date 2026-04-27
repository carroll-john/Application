#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/local/eligibility/repo"
  exit 1
fi

TARGET_REPO="$1"

if [[ ! -d "$TARGET_REPO/.git" ]]; then
  echo "Error: target must be a git repository: $TARGET_REPO"
  exit 1
fi

mkdir -p "$TARGET_REPO/docs/stakeholder-updates"
cp docs/eligibility-check-roadmap.md "$TARGET_REPO/docs/"
cp docs/eligibility-repo-separation.md "$TARGET_REPO/docs/"
cp docs/stakeholder-updates/2026-04-27-eligibility-note.md "$TARGET_REPO/docs/stakeholder-updates/"
cp docs/stakeholder-updates/README.md "$TARGET_REPO/docs/stakeholder-updates/"
cp README.md "$TARGET_REPO/docs/eligibility-bootstrap-handoff.md"

echo "Seed docs copied to $TARGET_REPO"
