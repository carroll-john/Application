#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/finish-task.sh [--force] [--keep-branch] <task name | branch | worktree path>

Examples:
  ./scripts/finish-task.sh "Fix auth redirect"
  ./scripts/finish-task.sh codex/fix-auth-redirect
  ./scripts/finish-task.sh /Users/jc/Documents/new-project-fix-auth-redirect
  ./scripts/finish-task.sh --force "Spike onboarding copy"

Removes the task worktree created by start-task and then deletes the codex branch.
Run this from a different checkout than the task worktree you want to remove.
EOF
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

resolve_path() {
  local input="$1"
  (
    cd "$input" >/dev/null 2>&1
    pwd -P
  )
}

find_worktree_for_branch() {
  local search_branch="$1"
  local listed_worktree=""
  local listed_branch=""

  while IFS= read -r line || [ -n "$line" ]; do
    if [ -z "$line" ]; then
      if [ "$listed_branch" = "$search_branch" ] && [ -n "$listed_worktree" ]; then
        printf '%s\n' "$listed_worktree"
        return 0
      fi
      listed_worktree=""
      listed_branch=""
      continue
    fi

    case "$line" in
      worktree\ *)
        listed_worktree="${line#worktree }"
        ;;
      branch\ refs/heads/*)
        listed_branch="${line#branch refs/heads/}"
        ;;
    esac
  done < <(git worktree list --porcelain; printf '\n')

  return 1
}

find_branch_for_worktree() {
  local search_worktree="$1"
  local listed_worktree=""
  local listed_branch=""

  while IFS= read -r line || [ -n "$line" ]; do
    if [ -z "$line" ]; then
      if [ "$listed_worktree" = "$search_worktree" ] && [ -n "$listed_branch" ]; then
        printf '%s\n' "$listed_branch"
        return 0
      fi
      listed_worktree=""
      listed_branch=""
      continue
    fi

    case "$line" in
      worktree\ *)
        listed_worktree="${line#worktree }"
        ;;
      branch\ refs/heads/*)
        listed_branch="${line#branch refs/heads/}"
        ;;
    esac
  done < <(git worktree list --porcelain; printf '\n')

  return 1
}

main() {
  local force=0
  local keep_branch=0
  local target=""
  local repo_root
  local current_worktree

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --force)
        force=1
        shift
        ;;
      --keep-branch)
        keep_branch=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      --)
        shift
        target="${*:-}"
        break
        ;;
      -*)
        echo "Unknown option: $1" >&2
        usage
        exit 1
        ;;
      *)
        target="${*:-}"
        break
        ;;
    esac
  done

  if [ -z "$target" ]; then
    echo "Task name, branch, or worktree path is required." >&2
    usage
    exit 1
  fi

  repo_root="$(git rev-parse --show-toplevel)"
  cd "$repo_root"
  current_worktree="$(pwd -P)"

  local target_branch=""
  local target_worktree=""
  local resolved_target_path=""

  if [ -d "$target" ]; then
    resolved_target_path="$(resolve_path "$target")"
    target_worktree="$resolved_target_path"
    target_branch="$(find_branch_for_worktree "$resolved_target_path" || true)"
  else
    if git show-ref --verify --quiet "refs/heads/$target"; then
      target_branch="$target"
    else
      local target_slug
      target_slug="$(slugify "$target")"
      if [ -n "$target_slug" ] && git show-ref --verify --quiet "refs/heads/codex/$target_slug"; then
        target_branch="codex/$target_slug"
      fi
    fi

    if [ -n "$target_branch" ]; then
      target_worktree="$(find_worktree_for_branch "$target_branch" || true)"
    fi
  fi

  if [ -z "$target_branch" ] && [ -z "$target_worktree" ]; then
    echo "Could not resolve '$target' to a codex task branch or worktree." >&2
    exit 1
  fi

  if [ -z "$target_branch" ]; then
    echo "Target '$target' is not attached to a branch-backed worktree." >&2
    echo "finish-task only manages task worktrees created from codex/* branches." >&2
    exit 1
  fi

  if [[ "$target_branch" != codex/* ]]; then
    echo "Refusing to operate on non-task branch '$target_branch'." >&2
    exit 1
  fi

  if [ -n "$target_worktree" ] && [ "$target_worktree" = "$current_worktree" ]; then
    echo "Refusing to remove the current worktree '$target_worktree'." >&2
    echo "Run finish-task from the main checkout or another worktree." >&2
    exit 1
  fi

  if [ -n "$target_worktree" ]; then
    if [ "$force" -eq 1 ]; then
      git worktree remove --force "$target_worktree"
    else
      git worktree remove "$target_worktree"
    fi
  fi

  if [ "$keep_branch" -eq 0 ]; then
    if [ "$force" -eq 1 ]; then
      git branch -D "$target_branch"
    else
      git branch -d "$target_branch"
    fi
  fi

  cat <<EOF
Finished task.

Branch: $target_branch
Worktree: ${target_worktree:-"(not attached)"}
Branch deleted: $([ "$keep_branch" -eq 0 ] && printf 'yes' || printf 'no')
Forced: $([ "$force" -eq 1 ] && printf 'yes' || printf 'no')
EOF
}

main "$@"
