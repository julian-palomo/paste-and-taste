# How the API deploys

- **Status:** Accepted
- **Date:** 2026-11-15, accepted 2026-11-16

## Context

`apps/api` is a Hono application on Cloudflare Workers
([2026-11-16-hono-on-workers.md](2026-11-16-hono-on-workers.md)). Today
it is deployed by hand, by the owner: `wrangler deploy --env preview` from a
laptop, then the smoke script against the Worker's address. The owner wants a
pipeline with sanity checks; this record compares two ways to build it.

What any pipeline has to respect:

- **The checks CI runs today** (`pnpm verify`: Biome, knip, typecheck, tests,
  build, hook tests) pass before a deploy, never after.
- **The build is one step.** `wrangler deploy` bundles `src/worker.ts`
  itself; `pnpm -C apps/api build` is the same bundle as a dry-run, which
  writes nothing to Cloudflare and needs no login.
- **`pnpm install` needs a git checkout.** The root `prepare` script runs
  `lefthook install`, which exits 128 in a copy of the repo without `.git`.
- **The smoke script runs after the deploy**: `pnpm -C apps/api smoke
  <address>` exits non-zero unless `/health` and an unknown route answer as
  specified. A failed smoke doesn't undo the deploy in either option; it makes
  the failure visible at once.
- **Versions:** Node from `.node-version` (26), pnpm from `packageManager`
  (12.21.0).

Checked against Cloudflare's Workers Builds docs on 15 November 2026:
[builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
[GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/).

## Options

### A. Workers Builds: Cloudflare builds from the connected repo

Cloudflare's GitHub app watches the repo. A push to the production branch runs
the build command, then the deploy command (default `npx wrangler deploy`);
other branches run the preview command (default `npx wrangler preview`) and
get a Preview URL. Status shows on GitHub as a check run and a pull request
comment.

- **What the owner sets up:** installs Cloudflare's GitHub app on the repo;
  in the dashboard, connects the Worker (its name must match
  `wrangler.jsonc`), sets the root directory `apps/api`, the build and deploy
  commands, and the production branch. The deploy command needs
  `--env production`, since the default `npx wrangler deploy` deploys the
  top-level config, whose `APP_ENV` is `development`, and the Worker to connect
  is the one with the environment suffix, `paste-and-taste-api-production`
  ([environments](https://developers.cloudflare.com/workers/wrangler/environments/));
  whether the dashboard's name check accepts that suffix is not documented.
  Cloudflare creates and holds the API token it deploys with; no token lives
  in GitHub.
- **Checks before a deploy:** only what the build command runs. The docs say
  nothing about waiting for GitHub's own checks, so a push to `main` deploys
  whatever CI says about it. Gating means repeating the checks in the build
  command (`pnpm verify`, which already bundles the Worker), on a second
  machine.
- **Smoke after:** no post-deploy step is documented. The deploy command can
  chain it: `wrangler deploy && pnpm smoke <address>`.
- **Git checkout:** not documented. The build image page covers the OS
  (Ubuntu 24.04), Node and pnpm, not how the repo is cloned. If `.git` is
  missing, the install fails on `prepare`. The fix: set
  `SKIP_DEPENDENCY_INSTALL` and start the build command with
  `pnpm install --frozen-lockfile --ignore-scripts`, which skips `prepare`.
- **Versions:** pnpm comes from `packageManager` through Corepack, so 12.21.0.
  Node is read from `.node-version`, but the image preinstalls 22.23.4 and
  24.22.1 only; whether it installs 26 is not documented and has to be tried.

### B. A GitHub Actions job that runs wrangler with a scoped token

A workflow on push to `main` runs the same jobs as CI, and a deploy job that
`needs:` all of them runs `pnpm -C apps/api exec wrangler deploy --env <env>`,
then the smoke script.

- **What the owner sets up:** a Cloudflare API token limited to editing
  Workers on this one account (the "Edit Cloudflare Workers" template), stored
  as a GitHub environment secret `CLOUDFLARE_API_TOKEN`, with
  `CLOUDFLARE_ACCOUNT_ID` beside it; wrangler reads both from the
  environment. A GitHub environment can also require the owner's approval
  before each production deploy.
- **Checks before a deploy:** the same jobs CI runs, through `needs:`. A red
  check means no deploy, and the checks run once, in one place.
- **Smoke after:** a step after the deploy, in the same job, with its output
  in the run's log.
- **Git checkout:** yes. `actions/checkout` leaves `.git` in place and the
  shared `.github/actions/setup` already installs with it; CI works this way
  today.
- **Versions:** the shared setup action reads `.node-version` and
  `packageManager`, the same as every CI job.

## Decision

**B, GitHub Actions.** It reuses what CI already proves (the setup action,
Node 26, the checks) and gates the deploy on them with `needs:`, where A would
run the checks a second time and deploy on push regardless of CI. Each of A's
open points (the git checkout, Node 26, a gate on GitHub's checks) is
undocumented and needs a trial run before it can be trusted. B's cost is a
token in GitHub; scoping it to Workers on one account and holding it in an
environment keeps that small.

What choosing B costs, beyond the token:

- The token's scope is the owner's to keep narrow, and its expiry has to be
  watched.
- Preview URLs per pull request come free with A; with B they are an extra
  job (`wrangler versions upload` on a branch), left for the pipeline's issue.
- Either way, a deploy that the smoke script fails stays live until it is
  rolled back or fixed.

The owner accepted B on 16 November 2026. Option A is the alternative that
lost, for the open points above. The pipeline is built in
[#35](https://github.com/julian-palomo/paste-and-taste/issues/35).

## Consequences seen while building it

Added by [#35](https://github.com/julian-palomo/paste-and-taste/issues/35), which asked for them:

- The workflow's trigger doesn't keep the token from a pull request, since a
  branch can edit a workflow to name an environment. Each GitHub
  environment's branch rule, `main` only, does.
- A workflow that names an environment GitHub doesn't have creates it without
  that rule, so the environments are created before the workflow first runs.
