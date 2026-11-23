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
the web app uses and the mobile app will use. A merge to `main` deploys it from GitHub
Actions, to preview and then production, each with a smoke test, once every
check has passed ([the record](docs/adr/2026-11-15-how-the-api-deploys.md),
[the owner's page](docs/deploying-the-api.md)). The web app's skeleton is in
[`apps/web`](apps/web): TanStack Start on Cloudflare Workers, with one page
rendered on the server, at `/en` and `/es`, that shows the API's health
through that client. It is styled with Tailwind CSS from one file of
placeholder tokens, every page shares a layout with a link to the other
language, and unknown addresses and errors get their own pages in both
languages ([the record](docs/adr/2026-11-23-tailwind-and-css-motion.md)). The app's look is chosen and
written down in [`DESIGN.md`](DESIGN.md), with its reference drawings in
[`docs/design/`](docs/design); no screen has it yet. The same pipeline deploys it after the API, to a
preview and a production Worker, each checked after its deploy; its server
reaches that environment's API through a Service binding
([the record](docs/adr/2026-11-23-how-the-web-app-deploys.md)). Neither is
indexed by search engines while the app is on `workers.dev`. The repo also holds the
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
- The look: a basil green on a warm off-white with a dark mode, Outfit and Nunito Sans, pills, and flat drawings of food and kitchen utensils. The mark is not decided.
- The interface is in Spanish and English from day one. On the web each language has its own address, `/en` and `/es`, and `/` sends a visitor to theirs.
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
pnpm -C apps/web dev              # the web app, localhost:5173, calling the API above
pnpm -C apps/web smoke <address> <environment>  # checks a running web app: /en, /es and the redirect of /
pnpm -C apps/api smoke <address> [environment]  # checks a running API: /health, with the environment it names, and an unknown route
```

## Licence

None yet, so all rights are reserved for now.
