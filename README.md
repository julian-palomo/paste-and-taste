# Paste & Taste

A working name. An app that saves a recipe shared from Instagram, YouTube or a
web page, so it can be kept, edited and cooked from.

## Status

No app code yet. The repo is a pnpm and Turborepo monorepo with its checks
wired, locally and in CI; each app arrives with its own issue. It also holds the
working agreement for the coding agents that build it: [`AGENTS.md`](AGENTS.md)
has the rules and [`.claude/README.md`](.claude/README.md) explains the Claude
Code setup.

[`docs/product.md`](docs/product.md) says what the app must do.

## Decided so far

Each decision has its record, with the options that lost, in
[`docs/adr/`](docs/adr/README.md).

- A monorepo with a React Native app, a web app and an API.
- Web: TanStack Start.
- API: NestJS on Cloudflare Workers. The first step is deploying the bare skeleton to a real Worker; if that fails, the fallbacks are NestJS on a Node host, or Hono on Workers.
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
bash .claude/hooks/tests/run.sh   # tests for the Claude Code hooks
```

## Licence

None yet, so all rights are reserved for now.
