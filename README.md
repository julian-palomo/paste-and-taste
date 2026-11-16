# Paste & Taste

A working name. An app that saves a recipe shared from Instagram, YouTube or a
web page, so it can be kept, edited and cooked from.

## Status

The repo is a pnpm and Turborepo monorepo with its checks wired, locally and
in CI; each app arrives with its own issue. The first is the API's skeleton in
[`apps/api`](apps/api): Hono on Cloudflare Workers, with validated
configuration, a health route and one error format, and no recipe endpoints
yet. It describes itself in an OpenAPI document, `apps/api/openapi.json`,
from which [`packages/api-client`](packages/api-client) gets the typed client
the web and mobile apps will use. It will deploy from GitHub Actions
([the record](docs/adr/2026-11-15-how-the-api-deploys.md)); that pipeline is
not built yet, so for now the owner deploys it by hand. It also holds the
working agreement for the coding agents that build it: [`AGENTS.md`](AGENTS.md)
has the rules and [`.claude/README.md`](.claude/README.md) explains the Claude
Code setup.

The Instagram prototype, throwaway code in
[`prototypes/instagram`](prototypes/instagram), measured which ways of reading a
public post work without a login; the figures are in
[`docs/research/instagram-reading.md`](docs/research/instagram-reading.md), and
how a post is read is proposed in
[`docs/adr/`](docs/adr/2026-11-16-how-an-instagram-post-is-read.md) and not
decided.

[`docs/product.md`](docs/product.md) says what the app must do, and
[`docs/roadmap.md`](docs/roadmap.md) in what order it is being built.

## Decided so far

Each decision has its record, with the options that lost, in
[`docs/adr/`](docs/adr/README.md).

- A monorepo with a React Native app, a web app and an API.
- Web: TanStack Start.
- API: Hono on Cloudflare Workers, organised the way NestJS taught: one module per feature and one function that wires the dependencies. NestJS on Workers was deployed first and held, and was replaced for what it needed on Workers.
- The API's contract: an OpenAPI document generated from the routes' zod schemas, and a typed client generated from that document.
- Login: Better Auth.
- Background work, such as importing a recipe: Cloudflare Workflows.
- The interface is in Spanish and English from day one.
- Tooling: pnpm workspaces with a version catalog, and Turborepo.

## Commands

Node and pnpm versions are pinned in `.node-version` and `package.json`.

```bash
pnpm install                      # dependencies, and the pre-commit hook
pnpm verify                       # everything CI runs
pnpm check                        # Biome, then typecheck
pnpm test                         # tests in every workspace
pnpm knip                         # unused files, exports and dependencies
pnpm contract:check               # the OpenAPI document and the client's types are up to date
bash .claude/hooks/tests/run.sh   # tests for the Claude Code hooks
pnpm -C apps/api dev              # the API on the local Workers runtime, localhost:8787
pnpm -C apps/api smoke <address>  # checks a running API: /health and an unknown route
```

## Licence

None yet, so all rights are reserved for now.
