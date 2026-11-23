# Deploying the API and the web app

A merge to `main` deploys `apps/api` and `apps/web` from GitHub Actions
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)). This page
is the owner's: how to set it up, how to read a run, and what to do when it
goes red. Why it works this way is in the records for
[the API](adr/2026-11-15-how-the-api-deploys.md) and
[the web app](adr/2026-11-23-how-the-web-app-deploys.md).

Each run is a chain of gates. Each job starts only when the one before it is
green:

1. **Checks**: the six jobs CI runs on a pull request (`ci.yml`, called as a
   reusable workflow).
2. **Deploy to preview**: the API. `wrangler deploy --env preview`, then the
   smoke script against the preview Worker, which must also answer that it is
   `preview`.
3. **Deploy web to preview**: the web app built for preview
   (`CLOUDFLARE_ENV=preview pnpm build`), `wrangler deploy --env preview`, then
   its check against the preview web Worker: `/en` and `/es` must show the
   status `ok` and `preview`, with `X-Robots-Tag: noindex`, and `/` must
   answer 302. Its server reaches the preview API through a Service binding.
4. **Deploy to production**: the API, the same as step 2, with `--env
   production`, and the Worker must answer that it is `production`.
5. **Deploy web to production**: the same as step 3, for production.

Nothing reaches production until both services passed on preview.

Agents never deploy, provision or set a secret. Everything below is done by
the owner.

## Setting it up

Do it in this order. Step 1 comes before any run of the deploy workflow: a
workflow that names an environment GitHub doesn't have creates it, with no
branch rule.

### 1. The two GitHub environments

In the repo's **Settings > Environments**, create `preview` and
`production`. In each one, under **Deployment branches and tags**, choose
**Selected branches and tags** and add `main`.

That branch rule is what keeps the token away from any branch other than
`main`. A pull request's branch can edit a workflow to name an environment,
but GitHub refuses to run that job. Never remove the rule.

### 2. The Cloudflare token

In the Cloudflare dashboard, **My Profile > API Tokens > Create Token**, start
from the **Edit Cloudflare Workers** template, then trim it to what this
deploy uses. The token ends up with four permissions:

| Policy  | Permission       | Level |
| ------- | ---------------- | ----- |
| Account | Workers Scripts  | Edit  |
| Account | Account Settings | Read  |
| User    | User Details     | Read  |
| User    | Memberships      | Read  |

A token trimmed this way deployed both environments on 22 November 2026
([the run](https://github.com/julian-palomo/paste-and-taste/actions/runs/45010902680)).

- **Delete the zone policy.** It holds only Workers Routes, and
  `apps/api/wrangler.jsonc` has no route.
- **In the account policy, untick everything but its two rows above.** On 22
  November 2026 the template also ticked Cloudflare Pages, Containers, Workers
  Agents Configuration, Workers Builds Configuration, Workers KV Storage,
  Workers Observability, Workers R2 Storage and Workers Tail. The Worker has
  no KV namespace, no R2 bucket and no container, the pipeline never reads a
  Worker's live logs, and Cloudflare's own builds aren't used. Left in, they
  would let the token write storage and other products across the account.
  The template's list changes: go by the table, not by a count. A row comes
  back in the pull request that needs it, such as a binding or a custom
  domain.
- **Leave the user policy as it is.**
- **In the account policy's resources, choose this account only.** Workers
  Scripts Edit can't be narrowed to one Worker, so the token can still change
  every Worker in the account.

The dashboard says Edit where
[Cloudflare's templates page](https://developers.cloudflare.com/fundamentals/api/reference/template/)
says Write.

If `wrangler deploy` fails on a permission, its error names the one it
lacks: add that row to the token and re-run the job.

The web app's Workers use the same token. A Service binding needs no
permission of its own:
[Cloudflare's roles page](https://developers.cloudflare.com/workers/authorization/workers/)
says "You do not need separate permissions on the bound resources to deploy
the Worker". The same page says "Creating a new Worker requires Workers Admin
because per-Worker permissions can only apply to Workers that already exist",
yet this token created both API Workers on their first runs. The web's Workers
also upload static assets, whose upload
[accepts](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/assets/subresources/upload/methods/create/)
"Workers Admin" or "Workers Scripts Write". The token is expected to be
enough, which only the web's first deploy shows.

Give the token an expiry date, and note that date: when the token expires,
deploys fail at the `wrangler deploy` step until it is replaced. Before
creating it, check the summary's start date: it should be today or earlier.

The account ID is in **Account home**: search (`Cmd/Ctrl + K`) for
`Copy account ID`
([Cloudflare's page](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)).

### 3. What goes in each environment

Before the merge, in each of `preview` and `production`:

| Kind     | Name                    | Value                                                     |
| -------- | ----------------------- | --------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`  | The token from step 2 (the same one in both).             |
| Secret   | `CLOUDFLARE_ACCOUNT_ID` | The account ID.                                           |
| Variable | `API_URL`               | `https://paste-and-taste-api-<env>.<subdomain>.workers.dev` |
| Variable | `WEB_URL`               | `https://paste-and-taste-web-<env>.<subdomain>.workers.dev` |

`API_URL` and `WEB_URL` are variables, not secrets: the workflow reads
`vars.API_URL` and `vars.WEB_URL`, and a secret with either name is never
read. `<env>` is `preview` or `production`, and `<subdomain>` is the account's
workers.dev subdomain. The web's server doesn't use `WEB_URL` or `API_URL`:
it reaches the API through its binding. `WEB_URL` is only where the check
looks.

The variables keep the addresses out of the repo, **not out of view**: the
smoke script and the web's check print them, so they show in every run's log,
which anyone can read on a public repo. The secrets never do: GitHub masks them, and only the
`wrangler deploy` step receives them.

## Reading a run

The **Actions** tab, workflow **Deploy**. A run's graph has five boxes:
`Checks` (open it to see the six jobs), `Deploy to preview`,
`Deploy web to preview`, `Deploy to production` and
`Deploy web to production`.

- **Green through the end:** all four Workers are deployed, and each answered
  its check. The last line of each API job is
  `OK <address> (<environment>): /health and an unknown route answer as specified`,
  and of each web job
  `OK <address> (<environment>): /en, /es and / answer as specified`.
- **Red in `Checks`:** nothing was deployed. Every deploy job shows as
  skipped. Fix it with a pull request, like any red CI.
- **Red at `wrangler deploy`:** that environment wasn't changed. Usually the
  token: expired, revoked, or missing from that environment.
- **Red at the smoke:** see below.

Runs never overlap. While one runs, the next waits; a third push while one
waits replaces the waiting run, which never started. A run in progress is
never cancelled.

## When the smoke fails

The smoke's `FAIL` lines say which route answered what.

- **On preview:** production wasn't touched, and its job shows as skipped.
  Preview runs the failing build until the next deploy. Fix it with a pull
  request; its merge deploys again.
- **On production:** the build is live and failing. Nothing rolls back on its
  own. Either roll back in the Cloudflare dashboard, **Workers & Pages >**
  the Worker **> Deployments**, the three-dot menu on the last good version,
  **Rollback**
  ([Cloudflare's page](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)),
  or merge a revert, which deploys through the same chain.

If `/health` names the wrong environment, as in
`/health answered environment "production"; expected "preview"`, the Worker at
`API_URL` is up but belongs to the other environment, so this job's Worker
wasn't checked. Fix `API_URL` in that GitHub environment and re-run the job.

If the smoke can't reach the address at all, check `API_URL` in that
environment first. The very first production deploy creates the Worker, and a
new workers.dev address can take a moment to answer: re-run that job before
concluding anything.

## When a web check fails

Its `FAIL` lines say which address answered what.

- **`/en doesn't show the status ok; it says "…"`** quotes the page's own
  message. "The API cannot be reached" or "answered with an error" means the
  web Worker is up but its binding to the API isn't answering as it should:
  check that the API's job for that environment is green, and the `services`
  entry for that environment in `apps/web/wrangler.jsonc`.
- **`shows the environment "production"; expected "preview"`**: the binding
  points to the other environment's API. Fix `apps/web/wrangler.jsonc` with a
  pull request.
- **`could not reach`**, or a 404 on every address: check `WEB_URL` in that
  GitHub environment first. The first web deploy creates its Worker, and a new
  workers.dev address can take a moment to answer: re-run the job before
  concluding anything.
- **`has no X-Robots-Tag: noindex`**: `INDEXING` in that environment's block of
  `apps/web/wrangler.jsonc` doesn't match the check's list.

What a red web job stops:

- **On preview:** both production jobs are skipped, the API's included.
  Preview's web runs the failing build until the next deploy.
- **On production:** the build is live and failing. Roll back the Worker
  `paste-and-taste-web-production` in the dashboard, as for the API above, or
  merge a revert.

## Trying the deployed path locally

`pnpm -C apps/web dev` calls the API over HTTP at `API_URL`. To run the
binding path, as deployed, on your machine (nothing is sent to Cloudflare):

```bash
CLOUDFLARE_ENV=preview pnpm -C apps/web build
# terminal 1
CLOUDFLARE_DEV_REGISTRY_PATH=/tmp/pt-registry pnpm -C apps/api exec wrangler dev --env preview
# terminal 2
CLOUDFLARE_DEV_REGISTRY_PATH=/tmp/pt-registry pnpm -C apps/web exec vite preview
# terminal 3
pnpm -C apps/web smoke http://localhost:4173 preview
```

The shared `CLOUDFLARE_DEV_REGISTRY_PATH` is what lets the two find each
other: wrangler and the Vite plugin otherwise keep their local registries in
different folders. It was observed, not documented. Stopping the API means
ending the whole `wrangler dev` (Ctrl+C in its terminal): its Worker keeps
answering the binding while any of its processes runs.

## Deploying again without a new commit

On the run's page, **Re-run all jobs**. It deploys that run's commit, so
re-running an old run puts old code live. To redeploy what is on `main`,
re-run its latest run. The workflow can't be started by hand from a branch.
