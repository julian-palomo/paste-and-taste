# Login on Workers prototype

Throwaway code for a spike: does login with Better Auth hold on a Worker on
the free plan, with its users in Postgres reached through Hyperdrive and
Drizzle, and how do Neon's free plan and PlanetScale's smallest node compare?
Nothing in `apps/` or `packages/` imports it, and it is deleted when the real
login replaces it. What stays is the report,
[`docs/research/login-on-workers.md`](../../docs/research/login-on-workers.md),
and its record in [`docs/adr/`](../../docs/adr/README.md).

It is exempt from "test first" (`AGENTS.md`, section 2).

## What is here

- `src/worker.ts`: the Worker. The first path segment picks the database:
  `/neon/...` and `/planetscale/...`, each through its own Hyperdrive binding,
  with the same code. Under it, `/api/auth/*` is Better Auth (email and
  password) and `/wake` runs `select 1`. Each request gets its own `pg` client
  and Better Auth instance, and the client is closed after the response.
  Until `RUN_TOKEN` is set, every request answers 401.
- `src/schema.ts` and `drizzle/`: Better Auth's four tables, and the migration
  `pnpm -C prototypes/login generate` writes from them. The migration is
  generated: never edit it.
- `src/measure.ts`: the measurements, run from the owner's machine. It prints
  only steps, hosts, counts, statuses, error bodies, UTC windows and timings,
  never the token, a cookie, a password or the address; pnpm's echo of the
  command line, the first line of the output, does show the address. Test
  users are `spike-<run>-<n>@example.com`. It stops at once when `RUN_TOKEN`
  is not set or the Worker refuses it.

| Step   | Per host                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| `cpu`  | 20 sign-ups, 20 sign-ins with the right password, 20 with a wrong one, 20 session reads, one a second, a minute between batches. Each batch prints its UTC window for the Query Builder. |
| `warm` | One `/wake`, then 50 session reads.                                                                              |
| `hung` | 500 session reads, one a second: each answer that wasn't 200, with its error.                                    |
| `cold` | 15 rounds, each after 35 idle minutes. 1–5: a request without the token (the Worker's own cold start), then one session read per host, in alternating order. 6–10: Neon only, `/wake` sent without waiting, and a session read 2 s after it was sent; 11–15: the same at 10 s. |

`warm`, `hung` and `cold` sign up their own user first, up to 5 tries. If no
sign-up succeeds (the CPU limit can cut it), the step reads `/wake` instead of
the session and says so in each line.

## The local check

Hyperdrive, its pool and its cache only exist on a deployed Worker: locally,
`wrangler dev` connects straight to the database each binding's variable
names. With a local Postgres 16 (`brew install postgresql@16`, then
`brew services start postgresql@16`):

```bash
/opt/homebrew/opt/postgresql@16/bin/createdb login_spike_neon
/opt/homebrew/opt/postgresql@16/bin/createdb login_spike_planetscale
DATABASE_URL=postgres://localhost:5432/login_spike_neon pnpm -C prototypes/login migrate
DATABASE_URL=postgres://localhost:5432/login_spike_planetscale pnpm -C prototypes/login migrate
printf 'RUN_TOKEN=%s\nBETTER_AUTH_SECRET=%s\n' "$(openssl rand -hex 16)" "$(openssl rand -hex 32)" > prototypes/login/.dev.vars
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_NEON="postgres://${USER}:local@localhost:5432/login_spike_neon" \
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_PLANETSCALE="postgres://${USER}:local@localhost:5432/login_spike_planetscale" \
  pnpm -C prototypes/login dev
```

Then, in a second terminal, with `RUN_TOKEN` set to the value in `.dev.vars`:
`pnpm -C prototypes/login measure http://localhost:8787 warm --count 5`.

- The local variable needs a user and a password even though Homebrew's
  Postgres trusts local connections; wrangler refuses the URL without them.
- Write `${USER}`, with braces: in zsh, `$USER:local` reads as `$USER` with
  the `:l` modifier followed by `ocal`, and the URL loses its password.
- Afterwards: `brew services stop postgresql@16`.

## The owner's run

Only the owner runs these; an agent never deploys, provisions or sets a
secret. Every command runs in the owner's own terminal (not a `!` in a Claude
Code session, so nothing it prints reaches an agent), in the repo's folder,
on this branch. Nothing they print is pasted anywhere except what step 10
names. Why each choice, the costs and the sources are in the plan on issue
[#42](https://github.com/julian-palomo/paste-and-taste/issues/42).

0. **Wrangler's account.** `pnpm -C prototypes/login exec wrangler whoami`,
   and `pnpm -C prototypes/login exec wrangler login` if it shows no account.
   The deploy token lives only in GitHub.
1. **Neon.** Console > **New Project**, name `paste-and-taste-login-spike`,
   region **AWS Europe (London)** > **Create project**. Then **Connect** with
   **Connection pooling** off, and copy the direct string: Hyperdrive pools.
2. **PlanetScale**, in its own dashboard: your organization > **New
   database** > **Postgres**, name `paste-and-taste-login-spike`, region
   London (`eu-west-2`), PS-5, single node. If the price shown is above
   20 USD a month, stop. > **Create database**. Then **Connect** > **Create
   default role**, and copy the string on port 5432 (6432 is PgBouncer).
3. **Migration and Hyperdrive, once per database**, the cache off. `read -rs`
   takes the paste without showing it or saving it in the shell history:

   ```bash
   read -rs DATABASE_URL && export DATABASE_URL     # paste the Neon string, then Enter; nothing shows
   pnpm -C prototypes/login migrate
   pnpm -C prototypes/login exec wrangler hyperdrive create paste-and-taste-login-spike-neon --connection-string="$DATABASE_URL" --caching-disabled
   unset DATABASE_URL
   ```

   Then the same with the PlanetScale string and the name
   `paste-and-taste-login-spike-planetscale`, with one more line right after
   the `read`. `pg` reads `sslrootcert` as a file name, so `sslrootcert=system`
   fails `migrate` with ENOENT; this removes it wherever it sits in the query,
   without showing the string:

   ```bash
   DATABASE_URL=$(node -e 'const u = new URL(process.env.DATABASE_URL); u.searchParams.delete("sslrootcert"); console.log(u.href)')
   ```

   If the dashboard gives the host, database, user and password separately
   instead of one string, build it from four hidden prompts instead of the
   first `read` (paste each value, then Enter; nothing shows):

   ```bash
   read -rs DB_HOST && read -rs DB_NAME && read -rs DB_USER && read -rs DB_PASSWORD
   export DB_HOST DB_NAME DB_USER DB_PASSWORD
   export DATABASE_URL=$(node -e 'const e = process.env; const u = new URL(`postgresql://${e.DB_HOST}:5432/${e.DB_NAME}?sslmode=verify-full`); u.username = e.DB_USER; u.password = e.DB_PASSWORD; console.log(u.href)')
   unset DB_HOST DB_NAME DB_USER DB_PASSWORD
   ```

   Note each printed `id`.
4. **The deploy config.**
   `cp prototypes/login/wrangler.jsonc prototypes/login/wrangler.deploy.jsonc`,
   and put the two ids in the copy. Git ignores it.
5. **Deploy.** `pnpm -C prototypes/login exec wrangler deploy --config wrangler.deploy.jsonc`.
   It prints the `workers.dev` address.
6. **Secrets**, generated and piped in so neither is ever shown:

   ```bash
   openssl rand -hex 32 | pnpm -C prototypes/login exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.deploy.jsonc
   export RUN_TOKEN=$(openssl rand -hex 32)
   printf %s "$RUN_TOKEN" | pnpm -C prototypes/login exec wrangler secret put RUN_TOKEN --config wrangler.deploy.jsonc
   ```

7. **Day 1, in the same terminal:** `pnpm -C prototypes/login measure <address> cpu`,
   then `warm`, then `hung`. Then, for each `cpu` batch's window, in
   **Workers & Pages** > `paste-and-taste-login-spike` > **Observability** >
   Query Builder: P50 and Max of `$workers.cpuTimeMs`, grouped by
   `$workers.event.request.path`; and the count of "Exceeded CPU Time Limits"
   under **Metrics > Errors > Invocation Statuses**.
8. **Overnight**, plugged in with the lid open (`caffeinate -i` doesn't stop a
   MacBook sleeping when the lid closes):
   `caffeinate -i pnpm -C prototypes/login measure <address> cold`.
9. **Day 2:** in the Neon console, the compute's status on the **Branches**
   page (Active or Idle) after at least 30 minutes with nothing calling it,
   twice; and the project's CU-hours at the start and the end of the day.
10. **Hand back** to the session: the script's printed lines, the Query
    Builder tables, the Neon readings and PlanetScale's shown cost. Leave out
    the first line of each run, `$ node src/measure.ts <address> …`: pnpm
    echoes the command line, and it holds the Worker's address.
11. **Delete, the same day**, and say the date:
    - `pnpm -C prototypes/login exec wrangler delete --config wrangler.deploy.jsonc` (its secrets go with it);
    - `pnpm -C prototypes/login exec wrangler hyperdrive delete <id>`, for each id;
    - PlanetScale: the database's **Settings**, at the bottom > **Delete
      database**, type its name > **Delete database**;
    - Neon: the project > **Settings** > **General** > **Delete project**;
    - `rm prototypes/login/wrangler.deploy.jsonc`.

`pnpm -C prototypes/login worker:bundle` bundles the Worker without writing
anything to Cloudflare.
