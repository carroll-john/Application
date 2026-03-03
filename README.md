# Application Prototype

University application prototype built with React, Vite, TypeScript, Tailwind, and Supabase.

## Repo Structure

- `src/`
  - `components/` shared UI and layout primitives
  - `context/` auth and application state providers
  - `hooks/` small shared hooks
  - `lib/` business logic, validation, persistence, and backend helpers
  - `pages/` route-level screens
- `docs/`
  - `project-memory.md` durable product and implementation decisions
  - `backend-rollout.md` Supabase and deployment setup
- `supabase/`
  - `migrations/` SQL migrations
  - `reset_test_data.sql` clean hosted test reset

## Core Commands

```bash
npm install
npm run dev
npm run dev:cv-parser-api
npm test
npm run build
npm run test:cv-parser
npm run start-task -- "Fix auth redirect"
npm run finish-task -- "Fix auth redirect"
```

## CV Parser Regression

Run a local parser API server (required for the regression script):

```bash
npm run dev:cv-parser-api
```

The parser API reads `OPENAI_API_KEY` from process environment. If your key is in `.env.local`, export it first:

```bash
set -a; source .env.local; set +a
```

When running on localhost, the app now falls back to `http://127.0.0.1:4190/api/parse-cv` if `/api/parse-cv` is missing from the frontend dev server.

Then run the mixed-format parser regression suite (`.txt`, `.docx`, `.pdf`) against that server:

```bash
npm run test:cv-parser
```

Include a real CV file in the same run:

```bash
npm run test:cv-parser -- --file "/absolute/path/to/CV.docx"
```

Optional flags:

- `--base-url http://127.0.0.1:4190`
- `--timeout-ms 240000`
- `--out-dir /tmp/my-cv-parser-run`
- `--no-strict` (do not fail exit code when cases fail)

The script writes `results.json` and `results.csv` to a timestamped folder in `/tmp` by default.

## PostHog CV Parser Experiment

The CV employment auto-draft flow is gated by PostHog feature flag `cv_parser_autofill_experiment` by default.

Configure these frontend env vars for experiment control:

```env
VITE_POSTHOG_KEY=your_posthog_project_api_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_CV_PARSER_FLAG=cv_parser_autofill_experiment
```

When the flag resolves to `enabled`, `on`, `true`, `test`, `treatment`, or `variant*`, CV auto-drafting runs.
All other variants are treated as control and skip the parser call after CV save.

The app captures experiment events:
- `cv_parser_experiment_exposure`
- `cv_parser_save_continue_clicked`
- `cv_parser_autofill_succeeded`
- `cv_parser_autofill_empty`
- `cv_parser_autofill_failed`
- `cv_parser_autofill_skipped_control`


## Start New Task

Use the task bootstrap whenever you want a fresh Codex workstream for an unrelated change.

```bash
npm run start-task -- "Fix auth redirect"
```

That command:

- creates a new `codex/<slug>` branch
- creates a sibling worktree next to the repo, for example `/Users/jc/Documents/new-project-fix-auth-redirect`
- prints the new path so the next Codex thread can stay isolated there
- refreshes `origin/master` and uses it as the default base
- refuses to branch from a base that does not include the latest `origin/master` commit

By default the helper refuses to run if the current checkout is dirty, which prevents unrelated in-progress edits from leaking into the new task. If you intentionally want to branch from the current committed `HEAD` while leaving local changes behind in the existing checkout, use:

```bash
npm run start-task -- --allow-dirty "Spike onboarding copy"
```

If you intentionally need to branch from something that is behind `origin/master`, override the stale-base guard:

```bash
npm run start-task -- --base codex/existing-feature --allow-behind-master "Follow-up changes"
```

If you are offline and want to skip the `origin/master` refresh step:

```bash
npm run start-task -- --no-fetch "Offline task setup"
```

## Finish Task

Use the cleanup helper after the task branch has been merged or when you want to discard the task worktree.

```bash
npm run finish-task -- "Fix auth redirect"
```

The helper resolves either the original task name, the full branch name, or the worktree path. It removes the sibling worktree first and then deletes the `codex/<slug>` branch with Git's safe delete behavior.
Before deleting the branch (without `--force`), it refreshes `origin/master` and verifies the task branch is already merged there.

Run it from the main checkout or another worktree, not from inside the task worktree you are trying to remove.

If you need to clean up an unmerged branch or a worktree with local changes, use:

```bash
npm run finish-task -- --force "Spike onboarding copy"
```

If you want to remove only the worktree and keep the branch around:

```bash
npm run finish-task -- --keep-branch "Spike onboarding copy"
```

If you are offline and want to skip the `origin/master` refresh during cleanup:

```bash
npm run finish-task -- --no-fetch "Offline cleanup"
```

## Notes

- Read `docs/project-memory.md` before making product or UX changes.
- The app is currently dogfooded behind a Keypath-only site gate.
- Localhost has a dev-only auth bypass for post-auth verification.
- PostHog is optional and activates when `VITE_POSTHOG_KEY` is set. Use `VITE_POSTHOG_HOST` to point at your PostHog region, for example `https://us.i.posthog.com`.
