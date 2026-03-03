#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/start-task.sh [--base <commit-ish>] [--allow-dirty] [--allow-behind-master] [--no-fetch] <task name>

Examples:
  ./scripts/start-task.sh "Fix auth redirect"
  ./scripts/start-task.sh --base origin/master "Dashboard telemetry"
  ./scripts/start-task.sh --base codex/existing-feature --allow-behind-master "Follow-up changes"
  ./scripts/start-task.sh --no-fetch "Offline task setup"
  ./scripts/start-task.sh --allow-dirty "Spike new onboarding copy"

Creates a sibling git worktree on a new codex/<slug> branch.
EOF
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

main() {
  local allow_dirty=0
  local allow_behind_master=0
  local no_fetch=0
  local base_ref=""
  local repo_root
  local task_name=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --base)
        if [ "$#" -lt 2 ]; then
          echo "Missing value for --base." >&2
          usage
          exit 1
        fi
        base_ref="$2"
        shift 2
        ;;
      --allow-dirty)
        allow_dirty=1
        shift
        ;;
      --allow-behind-master)
        allow_behind_master=1
        shift
        ;;
      --no-fetch)
        no_fetch=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      --)
        shift
        task_name="${*:-}"
        break
        ;;
      -*)
        echo "Unknown option: $1" >&2
        usage
        exit 1
        ;;
      *)
        task_name="${*:-}"
        break
        ;;
    esac
  done

  if [ -z "$task_name" ]; then
    echo "Task name is required." >&2
    usage
    exit 1
  fi

  repo_root="$(git rev-parse --show-toplevel)"
  cd "$repo_root"

  if [ -z "$base_ref" ]; then
    base_ref="origin/master"
  fi

  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "Remote 'origin' is required for task bootstrap." >&2
    exit 1
  fi

  if [ "$allow_dirty" -ne 1 ] && [ -n "$(git status --porcelain)" ]; then
    echo "Working tree has uncommitted changes." >&2
    echo "Commit or stash them first, or rerun with --allow-dirty to branch from committed HEAD only." >&2
    exit 1
  fi

  if [ "$no_fetch" -ne 1 ]; then
    if ! git fetch origin master --prune >/dev/null 2>&1; then
      echo "Could not refresh origin/master." >&2
      echo "Run 'git fetch origin master' and retry, or pass --no-fetch to skip this refresh." >&2
      exit 1
    fi
  fi

  if ! git rev-parse --verify "origin/master^{commit}" >/dev/null 2>&1; then
    echo "origin/master does not resolve to a commit." >&2
    exit 1
  fi

  if ! git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1; then
    echo "Base ref '$base_ref' does not resolve to a commit." >&2
    exit 1
  fi

  if [ "$allow_behind_master" -ne 1 ] && ! git merge-base --is-ancestor "origin/master" "$base_ref"; then
    local ahead_behind
    ahead_behind="$(git rev-list --left-right --count "origin/master...$base_ref")"
    echo "Base ref '$base_ref' is missing commits from origin/master." >&2
    echo "Divergence (origin/master...$base_ref): $ahead_behind" >&2
    echo "Rebase or merge origin/master into '$base_ref', or rerun with --allow-behind-master if intentional." >&2
    exit 1
  fi

  local task_slug
  task_slug="$(slugify "$task_name")"

  if [ -z "$task_slug" ]; then
    echo "Task name must contain letters or numbers." >&2
    exit 1
  fi

  local branch_name="codex/$task_slug"
  if git show-ref --verify --quiet "refs/heads/$branch_name"; then
    echo "Branch '$branch_name' already exists." >&2
    exit 1
  fi

  local repo_slug
  repo_slug="$(slugify "$(basename "$repo_root")")"

  local parent_dir
  parent_dir="$(dirname "$repo_root")"

  local worktree_path="$parent_dir/$repo_slug-$task_slug"
  if [ -e "$worktree_path" ]; then
    echo "Worktree path '$worktree_path' already exists." >&2
    exit 1
  fi

  git worktree add "$worktree_path" -b "$branch_name" "$base_ref"

  cat <<EOF
Started new task.

Task: $task_name
Base: $base_ref
Branch: $branch_name
Worktree: $worktree_path

Next:
  cd "$worktree_path"
EOF
}

main "$@"
