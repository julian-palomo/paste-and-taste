# Deploying the API

A merge to `main` deploys `apps/api` from GitHub Actions
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)). This page
is the owner's: how to set it up, how to read a run, and what to do when it
goes red. Why it works this way is in
[the record](adr/2026-11-15-how-the-api-deploys.md).

Each run is a chain of gates. Each job starts only when the one before it is
green:

1. **Checks**: the six jobs CI runs on a pull request (`ci.yml`, called as a
   reusable workflow).
2. **Deploy to preview**: `wrangler deploy --env preview`, then the smoke
   script against the preview Worker.
3. **Deploy to production**: the same, with `--env production`.

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

`API_URL` is a variable, not a secret: the workflow reads `vars.API_URL`, and
a secret with that name is never read. `<env>` is `preview` or `production`,
and `<subdomain>` is the account's workers.dev subdomain.

`API_URL` keeps the address out of the repo, **not out of view**: the smoke
script prints it, so it shows in every run's log, which anyone can read on a
public repo. The secrets never do: GitHub masks them, and only the
`wrangler deploy` step receives them.

## Reading a run

The **Actions** tab, workflow **Deploy**. A run's graph has three boxes:
`Checks` (open it to see the six jobs), `Deploy to preview` and
`Deploy to production`.

- **Green through the end:** both Workers are deployed, and both answered the
  smoke. The last line of each deploy job is `OK <address>: ...`.
- **Red in `Checks`:** nothing was deployed. Both deploy jobs show as
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

If the smoke can't reach the address at all, check `API_URL` in that
environment first. The very first production deploy creates the Worker, and a
new workers.dev address can take a moment to answer: re-run that job before
concluding anything.

## Deploying again without a new commit

On the run's page, **Re-run all jobs**. It deploys that run's commit, so
re-running an old run puts old code live. To redeploy what is on `main`,
re-run its latest run. The workflow can't be started by hand from a branch.
